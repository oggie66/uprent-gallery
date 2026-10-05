import Imap from 'imap'
import { createHash } from 'node:crypto'
import type { ParsedMail, AddressObject } from 'mailparser'
import {
  type Email,
  type EmailAttachment,
  EMAIL_CATEGORY,
} from '~core/database'
import { fetchMessages } from './email/fetch-messages'
import {
  parseSelectiveMessage,
  planMessage,
  sectionsFor,
  type MimeStructure,
} from './email/mime'

export class EmailServer {
  private readonly pending = new Map<string, Promise<Email[]>>()

  loadEmails(username: string, password: string): Promise<Email[]> {
    // Coalesce concurrent loads without sharing a mutable selected mailbox.
    const key = createHash('sha256')
      .update(JSON.stringify([username, password]))
      .digest('hex')
    const existing = this.pending.get(key)
    if (existing) return existing
    const request = this.loadMailbox(username, password).finally(() =>
      this.pending.delete(key),
    )
    this.pending.set(key, request)
    return request
  }

  private async loadMailbox(
    username: string,
    password: string,
  ): Promise<Email[]> {
    const connection = new Imap({
      user: username,
      password,
      host: '172.233.33.104',
      port: 993,
      tls: true,
      authTimeout: 10_000,
      connTimeout: 10_000,
    })
    let timeout: ReturnType<typeof setTimeout> | undefined
    let finished = false
    const interrupted = new Promise<never>((_resolve, reject) => {
      connection.on('error', reject)
      connection.once('end', () => {
        if (!finished)
          reject(
            new Error('The mail connection closed before loading finished.'),
          )
      })
      timeout = setTimeout(
        () =>
          reject(new Error('Loading the mailbox timed out. Please try again.')),
        30_000,
      )
    })
    const read = async () => {
      await new Promise<void>(resolve => {
        connection.once('ready', resolve)
        connection.connect()
      })
      await new Promise<void>((resolve, reject) => {
        connection.openBox('INBOX', true, error =>
          error ? reject(error) : resolve(),
        )
      })
      const uids = await new Promise<number[]>((resolve, reject) => {
        connection.search(['ALL'], (error, values) =>
          error ? reject(error) : resolve(values),
        )
      })
      const emails: Email[] = []
      for (let offset = 0; offset < uids.length; offset += 100) {
        emails.push(
          ...(await this.fetchBatch(
            connection,
            uids.slice(offset, offset + 100),
          )),
        )
      }
      return emails.sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
      )
    }
    try {
      return await Promise.race([read(), interrupted])
    } finally {
      finished = true
      clearTimeout(timeout)
      connection.destroy()
    }
  }

  private async fetchBatch(connection: Imap, uids: number[]): Promise<Email[]> {
    const summaries = await fetchMessages(connection, uids, {
      bodies: 'HEADER',
      struct: true,
    })
    // Messages with identical MIME layouts share one FETCH command.
    const groups = new Map<string, typeof summaries>()
    for (const message of summaries) {
      const structure = message.attributes.struct as MimeStructure | undefined
      if (!structure)
        throw new Error('The mail server did not return MIME structure.')
      const key = JSON.stringify(sectionsFor(planMessage(structure)))
      groups.set(key, [...(groups.get(key) || []), message])
    }
    const emails: Email[] = []
    for (const [key, group] of groups) {
      const bodies = await fetchMessages(
        connection,
        group.map(message => message.attributes.uid),
        { bodies: JSON.parse(key) as string[] },
      )
      const byUid = new Map(
        bodies.map(message => [message.attributes.uid, message]),
      )
      for (const message of group) {
        const { uid, flags, struct } = message.attributes
        const fetched = byUid.get(uid)
        // A message may be removed between SEARCH and FETCH.
        if (!fetched) continue
        const headers = message.bodies.get('HEADER')
        if (!headers)
          throw new Error('The mail server did not return message headers.')
        const parsed = await parseSelectiveMessage(
          headers,
          struct as MimeStructure,
          fetched.bodies,
        )
        emails.push(this.mapParsedToEmail(uid, flags || [], parsed))
      }
    }
    return emails
  }

  private mapParsedToEmail(
    uid: number,
    flags: string[],
    parsed: ParsedMail,
  ): Email {
    let categories: EMAIL_CATEGORY[] = []
    const categoryHeader = parsed.headers.get('x-uprent-categories')
    if (categoryHeader) {
      const val = Array.isArray(categoryHeader)
        ? categoryHeader[0]
        : (categoryHeader as string)

      if (typeof val === 'string') {
        categories = val
          .split(',')
          .map(c => c.trim())
          .filter((c): c is EMAIL_CATEGORY =>
            Object.values(EMAIL_CATEGORY).includes(c as EMAIL_CATEGORY),
          )
      }
    }

    const getAddress = (addr: AddressObject | AddressObject[] | undefined) => {
      if (!addr) return []
      const list = Array.isArray(addr) ? addr : [addr]
      return list.flatMap(a => a.value)
    }

    const fromArr = getAddress(parsed.from)
    const toArr = getAddress(parsed.to)
    const ccArr = getAddress(parsed.cc)

    // Map Attachments (Metadata only)
    const attachments: EmailAttachment[] = (parsed.attachments || []).map(
      (att, index) => ({
        uid: index, // simple index as ID
        contentType: att.contentType,
        filename: att.filename,
        size: att.size,
        related: att.related || false,
        contentId: att.contentId,
      }),
    )

    return {
      uid,
      flags,
      categories,
      seen: flags.includes('\\Seen'),
      messageId: parsed.messageId || `no-id-${uid}`,
      subject: parsed.subject || '',
      from: {
        name: fromArr[0]?.name || '',
        email: fromArr[0]?.address || 'unknown@sender.com',
      },
      to: toArr.map(v => ({ name: v.name || '', email: v.address || '' })),
      cc: ccArr.map(v => v.address || ''),
      datetime: (parsed.date || new Date()).toISOString(),
      references:
        typeof parsed.references === 'string'
          ? [parsed.references]
          : parsed.references || [],
      inReplyTo: parsed.inReplyTo,
      attachments,
      content: parsed.html || parsed.textAsHtml || parsed.text || '',
    }
  }
}

export const emailServer = new EmailServer()
