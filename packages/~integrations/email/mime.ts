import { simpleParser, type ParsedMail } from 'mailparser'

/** node-imap's BODYSTRUCTURE nodes; its published types use `any[]`. */
export interface MimePart {
  partID?: string
  type: string
  subtype?: string
  params?: Record<string, string> | null
  id?: string | null
  encoding?: string
  size?: number
  disposition?: { type: string; params?: Record<string, string> | null } | null
}

export type MimeStructure = [MimePart, ...MimeStructure[]]
export interface PlannedPart {
  id: string
  part: MimePart
  download: boolean
  attachment: boolean
}

export const planMessage = (structure: MimeStructure): PlannedPart[] => {
  const parts: PlannedPart[] = []
  const visit = (node: MimeStructure, path: string, related = false) => {
    const [part, ...children] = node
    if (!part || typeof part.type !== 'string')
      throw new Error('Invalid MIME structure.')
    const id = part.partID || path || '1'
    if (children.length && !part.partID) {
      children.forEach((child, index) =>
        visit(
          child,
          path ? `${path}.${index + 1}` : `${index + 1}`,
          related || part.type.toLowerCase() === 'related',
        ),
      )
      return
    }
    const disposition = part.disposition?.type.toLowerCase()
    const text =
      part.type.toLowerCase() === 'text' &&
      ['plain', 'html'].includes(part.subtype?.toLowerCase() || '') &&
      disposition !== 'attachment' &&
      !part.params?.name &&
      !part.disposition?.params?.filename
    const inline =
      !!part.id &&
      (related || disposition === 'inline') &&
      disposition !== 'attachment'
    parts.push({ id, part, download: text || inline, attachment: !text })
  }
  visit(structure, '')
  return parts
}

export const sectionsFor = (parts: PlannedPart[]): string[] =>
  parts.flatMap(part =>
    part.download ? [`${part.id}.MIME`, part.id] : [`${part.id}.MIME`],
  )

/** Rebuild the same MIME tree, leaving ordinary attachment payloads empty. */
export const assembleMessage = (
  headers: Buffer,
  structure: MimeStructure,
  sections: Map<string, Buffer>,
): Buffer => {
  const render = (node: MimeStructure, path: string, root = false): Buffer => {
    const [part, ...children] = node
    const id = part.partID || path || '1'
    if (children.length && !part.partID) {
      const boundary = part.params?.boundary
      if (!boundary || /[\r\n"]/.test(boundary))
        throw new Error('Invalid MIME boundary.')
      const header = root
        ? headers
        : Buffer.from(
            `Content-Type: multipart/${part.type}; boundary="${boundary}"\r\n\r\n`,
          )
      const chunks = [header]
      for (let index = 0; index < children.length; index++) {
        chunks.push(Buffer.from(`\r\n--${boundary}\r\n`))
        chunks.push(
          render(
            children[index],
            path ? `${path}.${index + 1}` : `${index + 1}`,
          ),
        )
      }
      chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`))
      return Buffer.concat(chunks)
    }
    const header = root ? headers : sections.get(`${id}.MIME`)
    if (!header) throw new Error(`Missing MIME headers for part ${id}.`)
    return Buffer.concat([header, sections.get(id) || Buffer.alloc(0)])
  }
  return render(structure, '', true)
}

export const parseSelectiveMessage = async (
  headers: Buffer,
  structure: MimeStructure,
  sections: Map<string, Buffer>,
): Promise<ParsedMail> => {
  const parts = planMessage(structure)
  for (const part of parts) {
    if (part.download && !sections.has(part.id)) {
      throw new Error(`Missing MIME body for part ${part.id}.`)
    }
  }
  const parsed = await simpleParser(
    assembleMessage(headers, structure, sections),
  )
  const attachments = parts.filter(part => part.attachment)
  parsed.attachments.forEach((attachment, index) => {
    const planned = attachments[index]
    if (!planned || planned.download) return
    // BODYSTRUCTURE reports encoded octets. Prefer the optional decoded SIZE
    // parameter when present; otherwise retain the server-reported upper bound.
    const declaredSize = Number(planned.part.disposition?.params?.size)
    attachment.size =
      Number.isSafeInteger(declaredSize) && declaredSize >= 0
        ? declaredSize
        : planned.part.size || 0
  })
  return parsed
}
