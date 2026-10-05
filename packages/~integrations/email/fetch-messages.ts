import type Imap from 'imap'

export interface FetchedMessage {
  attributes: Imap.ImapMessageAttributes
  bodies: Map<string, Buffer>
}

/** Wait for body streams as well as FETCH completion; propagate every error. */
export const fetchMessages = (
  connection: Imap,
  uids: number[],
  options: Imap.FetchOptions,
): Promise<FetchedMessage[]> =>
  new Promise((resolve, reject) => {
    const request = connection.fetch(uids, { ...options, markSeen: false })
    const messages: Promise<FetchedMessage>[] = []
    request.on('message', (message: Imap.ImapMessage) => {
      const pending = new Promise<FetchedMessage>(
        (resolveMessage, rejectMessage) => {
          let attributes: Imap.ImapMessageAttributes | undefined
          const bodies = new Map<string, Buffer>()
          const streams: Promise<void>[] = []
          message.once('attributes', (value: Imap.ImapMessageAttributes) => {
            attributes = value
          })
          message.on('body', (stream, info) => {
            streams.push(
              new Promise<void>((resolveBody, rejectBody) => {
                const chunks: Buffer[] = []
                stream.on('data', (chunk: Buffer) => chunks.push(chunk))
                stream.once('error', rejectBody)
                stream.once('end', () => {
                  bodies.set(info.which, Buffer.concat(chunks))
                  resolveBody()
                })
              }),
            )
            void streams[streams.length - 1].catch(rejectMessage)
          })
          message.once('error', rejectMessage)
          message.once('end', () => {
            void Promise.all(streams)
              .then(() => {
                if (!attributes)
                  throw new Error(
                    'IMAP response is missing message attributes.',
                  )
                resolveMessage({ attributes, bodies })
              })
              .catch(rejectMessage)
          })
        },
      )
      // Attach a rejection handler immediately, before FETCH emits its end event.
      void pending.catch(reject)
      messages.push(pending)
    })
    request.once('error', reject)
    request.once('end', () => {
      void Promise.all(messages).then(resolve, reject)
    })
  })
