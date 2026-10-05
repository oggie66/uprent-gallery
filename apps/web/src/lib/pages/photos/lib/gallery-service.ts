import api from '~api'

export type PropertyAction = 'apply' | 'dismiss'

export const submitPropertyAction = async (
  action: PropertyAction,
  signal: AbortSignal,
) => {
  const endpoint =
    action === 'apply'
      ? api.properties.autoApply
      : api.properties.markAsNotInterested
  const { data, error } = await endpoint.post(undefined, { fetch: { signal } })
  if (error || !data || data.status !== 'success') {
    throw new Error(
      action === 'apply'
        ? 'Your application was not sent. Please try again.'
        : 'The property could not be marked. Please try again.',
    )
  }
}

export const cleanPhoto = async (
  source: string,
  signal: AbortSignal,
): Promise<{ preview: Blob | null; removedItems: string[] }> => {
  const original = await fetch(source, { signal })
  if (!original.ok)
    throw new Error(
      'The original photo could not be loaded. Try another photo.',
    )
  const blob = await original.blob()
  if (!blob.type.startsWith('image/'))
    throw new Error('This file is not a supported image.')
  const { data, error } = await api.properties.cleanImage.post(
    {
      image: new File(
        [blob],
        decodeURIComponent(
          new URL(source, window.location.href).pathname.split('/').pop() ||
            'photo',
        ),
        { type: blob.type },
      ),
    },
    { fetch: { signal } },
  )
  if (error || !data || data.mock !== true) {
    throw new Error(
      'The mock cleanup could not be completed. Your original photo is unchanged.',
    )
  }
  return {
    preview: data.removedItems.length ? blob : null,
    removedItems: data.removedItems,
  }
}
