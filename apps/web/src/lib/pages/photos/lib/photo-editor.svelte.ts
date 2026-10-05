import { cleanPhoto } from './gallery-service'
import { cleanupNotice } from '~core/photo-cleanup'

/** Keep the simulation visible without delaying cancellation or gallery closure. */
const waitForMockAnimation = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const finish = () => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })

/** A preview belongs to an original URL, never to the current slide index. */
export const createPhotoEditor = (completed: Record<string, boolean>) => {
  let previews = $state<Record<string, string>>({})
  let failures = $state<Record<string, string>>({})
  let active = $state<{ source: string; controller: AbortController } | null>(
    null,
  )
  let disposed = false
  let notice = $state('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  const clean = async (source: string) => {
    if (disposed || active || completed[source]) return
    const controller = new AbortController()
    active = { source, controller }
    failures[source] = ''
    notice = ''
    clearTimeout(noticeTimer)
    const timeout = setTimeout(() => controller.abort('timeout'), 30_000)
    const startedAt = performance.now()
    try {
      const result = await cleanPhoto(source, controller.signal)
      await waitForMockAnimation(
        Math.max(0, 2000 - (performance.now() - startedAt)),
        controller.signal,
      )
      if (!disposed && !controller.signal.aborted) {
        if (result.preview)
          previews[source] = URL.createObjectURL(result.preview)
        completed[source] = true
        notice = cleanupNotice(result.removedItems)
        noticeTimer = setTimeout(() => {
          notice = ''
        }, 6000)
      }
    } catch (error) {
      if (!disposed && controller.signal.reason !== 'cancelled') {
        failures[source] = controller.signal.aborted
          ? 'Creating the preview took too long. Please try again.'
          : error instanceof TypeError
            ? 'Could not reach the photo service. Check your connection and try again.'
            : error instanceof Error
              ? error.message
              : 'Could not create a preview. Please try again.'
      }
    } finally {
      clearTimeout(timeout)
      if (active?.controller === controller) active = null
    }
  }

  return {
    get notice() {
      return notice
    },
    dismissNotice: () => {
      clearTimeout(noticeTimer)
      notice = ''
    },
    get previews() {
      return previews
    },
    get failures() {
      return failures
    },
    get activeSource() {
      return active?.source ?? null
    },
    clean,
    cancel: () => active?.controller.abort('cancelled'),
    dispose: () => {
      disposed = true
      clearTimeout(noticeTimer)
      active?.controller.abort('cancelled')
      for (const url of Object.values(previews)) URL.revokeObjectURL(url)
      previews = {}
    },
  }
}
