import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type Imap from 'imap'
import { simpleParser } from 'mailparser'
import {
  parseSelectiveMessage,
  planMessage,
  sectionsFor,
  type MimeStructure,
} from '../packages/~integrations/email/mime'
import { fetchMessages } from '../packages/~integrations/email/fetch-messages'

const headers = Buffer.from(
  'From: Sender <sender@example.com>\r\nTo: Reader <reader@example.com>\r\nSubject: =?UTF-8?Q?Caf=C3=A9?=\r\nContent-Type: multipart/mixed; boundary="outer"\r\n\r\n',
)
const structure: MimeStructure = [
  { type: 'mixed', params: { boundary: 'outer' } },
  [
    { type: 'alternative', params: { boundary: 'inner' } },
    [{ partID: '1.1', type: 'text', subtype: 'plain', size: 10 }],
    [{ partID: '1.2', type: 'text', subtype: 'html', size: 20 }],
  ],
  [
    {
      partID: '2',
      type: 'application',
      subtype: 'pdf',
      size: 500_000_000,
      encoding: 'base64',
      disposition: { type: 'attachment', params: { filename: 'lease.pdf' } },
    },
  ],
]
const sections = new Map([
  [
    '1.1.MIME',
    Buffer.from(
      'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n',
    ),
  ],
  ['1.1', Buffer.from('Caf=C3=A9')],
  [
    '1.2.MIME',
    Buffer.from(
      'Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n',
    ),
  ],
  ['1.2', Buffer.from(Buffer.from('<p>Café</p>').toString('base64'))],
  [
    '2.MIME',
    Buffer.from(
      'Content-Type: application/pdf\r\nContent-Disposition: attachment; filename="lease.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n',
    ),
  ],
])

describe('selective MIME loading', () => {
  test('fetches text bodies and attachment metadata without attachment payloads', () => {
    expect(sectionsFor(planMessage(structure))).toEqual([
      '1.1.MIME',
      '1.1',
      '1.2.MIME',
      '1.2',
      '2.MIME',
    ])
  })
  test('preserves decoded HTML, encoded subject and attachment metadata', async () => {
    const parsed = await parseSelectiveMessage(headers, structure, sections)
    expect(parsed.subject).toBe('Café')
    expect(parsed.html).toBe('<p>Café</p>')
    expect(parsed.text).toBe('Café')
    expect(parsed.attachments[0].filename).toBe('lease.pdf')
    expect(parsed.attachments[0].size).toBe(500_000_000)
    expect(parsed.attachments[0].content.length).toBe(0)
  })
  test('handles a plain-text message without multipart wrappers', async () => {
    const single: MimeStructure = [
      { type: 'text', subtype: 'plain', partID: '1' },
    ]
    const parsed = await parseSelectiveMessage(
      Buffer.from('Content-Type: text/plain; charset=utf-8\r\n\r\n'),
      single,
      new Map([['1', Buffer.from('Hello there')]]),
    )
    expect(parsed.text).toBe('Hello there')
  })
  test('preserves CID images in related HTML', async () => {
    const related: MimeStructure = [
      { type: 'related', params: { boundary: 'related' } },
      [{ partID: '1', type: 'text', subtype: 'html' }],
      [{ partID: '2', type: 'image', subtype: 'png', id: '<photo>' }],
    ]
    const source =
      'Content-Type: multipart/related; boundary="related"\r\n\r\n--related\r\nContent-Type: text/html\r\n\r\n<img src="cid:photo">\r\n--related\r\nContent-Type: image/png\r\nContent-ID: <photo>\r\nContent-Transfer-Encoding: base64\r\n\r\naGVsbG8=\r\n--related--\r\n'
    const original = await simpleParser(source)
    const parsed = await parseSelectiveMessage(
      Buffer.from(
        'Content-Type: multipart/related; boundary="related"\r\n\r\n',
      ),
      related,
      new Map([
        ['1.MIME', Buffer.from('Content-Type: text/html\r\n\r\n')],
        ['1', Buffer.from('<img src="cid:photo">')],
        [
          '2.MIME',
          Buffer.from(
            'Content-Type: image/png\r\nContent-ID: <photo>\r\nContent-Transfer-Encoding: base64\r\n\r\n',
          ),
        ],
        ['2', Buffer.from('aGVsbG8=')],
      ]),
    )
    expect(parsed.html).toBe(original.html)
    expect(parsed.attachments[0].content).toEqual(
      original.attachments[0].content,
    )
    expect(sectionsFor(planMessage(related))).toContain('2')
  })
  test('does not treat attached text or forwarded messages as display bodies', () => {
    const attachments: MimeStructure = [
      { type: 'mixed' },
      [
        {
          partID: '1',
          type: 'text',
          subtype: 'plain',
          disposition: { type: 'attachment' },
        },
      ],
      [
        {
          partID: '2',
          type: 'message',
          subtype: 'rfc822',
          disposition: { type: 'attachment' },
        },
        [{ partID: '2.1', type: 'text', subtype: 'html' }],
      ],
    ]
    expect(sectionsFor(planMessage(attachments))).toEqual(['1.MIME', '2.MIME'])
  })
  test('rejects incomplete MIME data rather than silently losing messages', async () => {
    await expect(
      parseSelectiveMessage(headers, structure, new Map()),
    ).rejects.toThrow('Missing MIME body')
  })
})

describe('IMAP event handling', () => {
  test('awaits body streams even if the message and FETCH finish first', async () => {
    const fetch = new EventEmitter()
    const connection = {
      fetch: (_uids: number[], options: Imap.FetchOptions) => {
        expect(options.markSeen).toBe(false)
        return fetch
      },
    } as unknown as Imap
    const pending = fetchMessages(connection, [1], { bodies: 'HEADER' })
    const message = new EventEmitter()
    const stream = new PassThrough()
    fetch.emit('message', message)
    message.emit('body', stream, { which: 'HEADER' })
    message.emit('attributes', { uid: 1, flags: [] })
    message.emit('end')
    fetch.emit('end')
    stream.end('Subject: Hello\r\n')
    expect((await pending)[0].bodies.get('HEADER')?.toString()).toBe(
      'Subject: Hello\r\n',
    )
  })
  test('propagates FETCH errors', async () => {
    const fetch = new EventEmitter()
    const pending = fetchMessages(
      { fetch: () => fetch } as unknown as Imap,
      [1],
      {},
    )
    fetch.emit('error', new Error('Disconnected'))
    await expect(pending).rejects.toThrow('Disconnected')
  })
})
