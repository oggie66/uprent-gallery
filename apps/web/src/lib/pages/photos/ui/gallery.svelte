<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { BasePropertySchema } from '~core/database'
  import { createPhotoEditor } from '../lib/photo-editor.svelte'
  import {
    submitPropertyAction,
    type PropertyAction,
  } from '../lib/gallery-service'
  import PhotoFrame from './photo-frame.svelte'
  import PropertyInfo from './property-info.svelte'

  let {
    property,
    completedCleanups,
    onClose,
    onComplete,
    onPhotoUnavailable,
  }: {
    property: BasePropertySchema
    completedCleanups: Record<string, boolean>
    onPhotoUnavailable: (source: string) => void
    onClose: () => void
    onComplete: (action: PropertyAction) => void
  } = $props()
  let photos = $state(property.imageURLs.filter(Boolean))
  const editor = createPhotoEditor(completedCleanups)
  let dialog: HTMLDialogElement
  let thumbnails = $state<HTMLDivElement>()
  let index = $state(0)
  let overview = $state(false)
  let showOriginal = $state(false)
  let action = $state<PropertyAction | null>(null)
  let actionError = $state('')
  let actionController: AbortController | undefined
  let startTouch: { x: number; y: number } | undefined
  const current = $derived(photos[index])
  const preview = $derived(current ? editor.previews[current] : undefined)
  const safeListingUrl = (() => {
    try {
      const url = new URL(property.sourceURL)
      return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
    } catch {
      return undefined
    }
  })()

  onMount(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      document.body.style.overflow = overflow
      actionController?.abort()
      editor.dispose()
    }
  })

  const removePhoto = (source: string) => {
    const position = photos.indexOf(source)
    if (position < 0) return
    photos = photos.filter(photo => photo !== source)
    if (position < index) index--
    index = Math.max(0, Math.min(index, photos.length - 1))
    if (position === index) showOriginal = false
    onPhotoUnavailable(source)
  }

  const goTo = async (next: number) => {
    if (!photos.length) return
    index = Math.max(0, Math.min(photos.length - 1, Math.trunc(next)))
    showOriginal = false
    overview = false
    await tick()
    thumbnails?.querySelector(`[data-photo-index="${index}"]`)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })
  }

  const step = (direction: number) => {
    if (!photos.length) return
    void goTo((index + direction + photos.length) % photos.length)
  }

  const keyboard = (event: KeyboardEvent) => {
    if (
      (event.target as HTMLElement).closest(
        'input, select, textarea, [contenteditable="true"]',
      )
    )
      return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      void goTo(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      void goTo(photos.length - 1)
    }
  }

  const submit = async (next: PropertyAction) => {
    if (action) return
    action = next
    actionError = ''
    actionController = new AbortController()
    const timeout = setTimeout(() => actionController?.abort(), 15_000)
    try {
      await submitPropertyAction(next, actionController.signal)
      onComplete(next)
      dialog.close()
    } catch {
      actionError = actionController.signal.aborted
        ? 'The request timed out. Please try again.'
        : next === 'apply'
          ? 'Your application was not sent. Check that the API is running and try again.'
          : 'The property could not be marked. Check that the API is running and try again.'
    } finally {
      clearTimeout(timeout)
      action = null
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-label={`Photo gallery for ${property.title}`}
  onclose={onClose}
  onkeydown={keyboard}
  oncancel={event => {
    if (action) event.preventDefault()
  }}
  class=".fixed .inset-0 .m-0 .h-dvh .max-h-none .w-screen .max-w-none .overflow-hidden .border-0 .bg-white .p-0 .text-black"
>
  {#if editor.notice}
    <div
      role="status"
      class=".absolute .bottom-5 .left-1/2 .z-50 .flex .max-w-[calc(100%-32px)] .-translate-x-1/2 .items-center .gap-3 .rounded-xl .bg-gray-900 .px-4 .py-3 .text-sm .text-white .shadow-lg"
    >
      <span
        ><span class=".mr-2 .text-xs .text-gray-400">Mock</span
        >{editor.notice}</span
      ><button
        type="button"
        aria-label="Dismiss notification"
        onclick={editor.dismissNotice}
        class=".p-1">×</button
      >
    </div>
  {/if}
  <div class=".flex .h-full .flex-col">
    <header
      class=".flex .shrink-0 .items-center .justify-between .gap-4 .border-b .border-gray-100 .px-6 .py-4 sm:.px-4 sm:.py-3"
    >
      <div class=".min-w-0">
        <p
          class=".text-xs .font-semibold .uppercase .tracking-[0.18em] .text-primary"
        >
          Uprent <span class=".font-normal .tracking-normal .text-gray-400"
            >/ a closer look</span
          >
        </p>
        <h1 class=".mt-1 .truncate .text-base .font-semibold">
          {property.title}, {property.cityName}
        </h1>
      </div>
      <button
        type="button"
        aria-label="Close gallery"
        disabled={!!action}
        onclick={() => dialog.close()}
        class=".flex .h-10 .w-10 .shrink-0 .items-center .justify-center .rounded-full .bg-gray-100 .text-2xl hover:.bg-gray-200 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-primary disabled:.opacity-50"
        >×</button
      >
    </header>

    <div
      class=".grid .min-h-0 .flex-1 .grid-cols-[minmax(0,1fr)_30vw] lg:.flex lg:.flex-col lg:.overflow-y-auto"
    >
      <div
        class=".flex .min-h-0 .flex-col .bg-[#141719] lg:.min-h-[60dvh] lg:.shrink-0"
      >
        <div
          class=".flex .shrink-0 .items-center .justify-between .gap-3 .px-5 .py-3 .text-xs .text-gray-300 sm:.px-3"
        >
          <p class=".mb-0 .truncate">
            Photos from {#if safeListingUrl}<a
                href={safeListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                class=".font-medium .text-white .underline .underline-offset-2 focus-visible:.outline"
                >{property.platformName || property.sourceName} ↗</a
              >{:else}{property.platformName || property.sourceName}{/if}
          </p>
          {#if photos.length > 1}<button
              type="button"
              aria-pressed={overview}
              onclick={() => (overview = !overview)}
              class=".shrink-0 .rounded-md .border .border-white/20 .px-3 .py-1.5 hover:.bg-white/10 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
              >{overview
                ? 'Back to photo'
                : `All ${photos.length} photos`}</button
            >{/if}
        </div>

        <div
          class=".relative .min-h-0 .flex-1 lg:.min-h-[35dvh]"
          ontouchstart={event => {
            const touch = event.touches[0]
            startTouch = { x: touch.clientX, y: touch.clientY }
          }}
          ontouchend={event => {
            if (!startTouch || overview) return
            const touch = event.changedTouches[0]
            const dx = touch.clientX - startTouch.x
            const dy = touch.clientY - startTouch.y
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
              step(dx < 0 ? 1 : -1)
            startTouch = undefined
          }}
        >
          {#if !photos.length}
            <div
              class=".flex .h-full .items-center .justify-center .p-8 .text-sm .text-gray-300"
            >
              No photos are available for this property.
            </div>
          {:else if overview}
            <div
              class=".absolute .inset-0 .grid .grid-cols-[repeat(auto-fill,minmax(130px,1fr))] .content-start .gap-3 .overflow-y-auto .p-4"
            >
              {#each photos as source, photoIndex (source)}
                <button
                  type="button"
                  aria-label={`View photo ${photoIndex + 1}`}
                  onclick={() => goTo(photoIndex)}
                  class=".relative .aspect-[4/3] .overflow-hidden .rounded-lg .bg-gray-800 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
                  ><PhotoFrame
                    src={source}
                    onUnavailable={removePhoto}
                    alt={`Photo ${photoIndex + 1}`}
                    thumbnail
                  /><span
                    class=".absolute .bottom-2 .left-2 .rounded .bg-black/70 .px-2 .py-1 .text-xs .text-white"
                    >{photoIndex + 1}</span
                  ></button
                >
              {/each}
            </div>
          {:else}
            <PhotoFrame
              src={preview && !showOriginal ? preview : current}
              onUnavailable={source => {
                if (source === preview) showOriginal = true
                else removePhoto(source)
              }}
              alt={`${property.title} — photo ${index + 1}${preview && !showOriginal ? ', mock preview' : ''}`}
            />
            {#if editor.activeSource === current}
              <div
                class=".pointer-events-none .absolute .inset-0 .flex .items-center .justify-center .bg-black/25 .backdrop-blur-md"
                role="status"
                aria-label="Cleaning photo"
              >
                <div
                  class=".flex .flex-col .items-center .gap-3 .rounded-2xl .bg-black/60 .px-6 .py-5 .text-sm .font-medium .text-white"
                >
                  <span
                    aria-hidden="true"
                    class=".h-8 .w-8 .animate-spin .rounded-full .border-[3px] .border-white/30 .border-t-white motion-reduce:.animate-none"
                  ></span>
                  Cleaning photo…
                </div>
              </div>
            {/if}
            {#if preview}<span
                class=".absolute .left-4 .top-3 .rounded-full .bg-black/70 .px-3 .py-1.5 .text-xs .font-medium .text-white"
                >{showOriginal ? 'Original photo' : 'Mock preview'}</span
              >{/if}
            {#if photos.length > 1}
              <button
                type="button"
                aria-label="Previous photo"
                onclick={() => step(-1)}
                class=".absolute .left-3 .top-1/2 .flex .h-11 .w-11 .-translate-y-1/2 .select-none .items-center .justify-center .rounded-full .border .border-white/20 .bg-black/60 .text-2xl .text-white hover:.bg-black/90 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white disabled:.opacity-20"
                >‹</button
              >
              <button
                type="button"
                aria-label="Next photo"
                onclick={() => step(1)}
                class=".absolute .right-3 .top-1/2 .flex .h-11 .w-11 .-translate-y-1/2 .select-none .items-center .justify-center .rounded-full .border .border-white/20 .bg-black/60 .text-2xl .text-white hover:.bg-black/90 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white disabled:.opacity-20"
                >›</button
              >
            {/if}
          {/if}
        </div>

        {#if photos.length}
          <div class=".shrink-0 .space-y-3 .px-5 .pb-4 .pt-3 sm:.px-3">
            <div
              class=".flex .flex-wrap .items-center .justify-between .gap-2 .text-xs .text-gray-300"
            >
              <label class=".flex .items-center .gap-2"
                >Photo <input
                  aria-label="Go to photo number"
                  type="number"
                  min="1"
                  max={photos.length}
                  value={index + 1}
                  onblur={event => {
                    const value = Number(event.currentTarget.value)
                    void goTo(Number.isFinite(value) ? value - 1 : index)
                    event.currentTarget.value = String(index + 1)
                  }}
                  onkeydown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  class=".w-14 .rounded .border .border-white/20 .bg-transparent .px-2 .py-1.5 .text-center .text-white focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
                />
                of {photos.length}</label
              >
              <div class=".flex .flex-wrap .items-center .gap-2">
                {#if editor.activeSource}
                  <span role="status"
                    >{editor.activeSource === current
                      ? 'Running mock cleanup…'
                      : 'Another photo is being cleaned…'}</span
                  ><button
                    type="button"
                    onclick={editor.cancel}
                    class=".rounded .px-2 .py-2 .underline focus-visible:.outline"
                    >Cancel</button
                  >
                {:else if completedCleanups[current]}
                  <button
                    type="button"
                    aria-pressed={showOriginal}
                    onclick={() => (showOriginal = !showOriginal)}
                    class=".rounded-lg .border .border-white/30 .px-3 .py-2 .font-medium .text-white focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
                    >{showOriginal
                      ? 'Show cleaned up photo'
                      : 'Show original'}</button
                  >
                {:else}
                  <button
                    type="button"
                    onclick={() => editor.clean(current)}
                    class=".rounded-lg .bg-white .px-3 .py-2 .font-medium .text-gray-900 hover:.bg-gray-200 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-offset-2 focus-visible:.outline-white"
                    >✧ Clean this photo</button
                  >
                {/if}
              </div>
            </div>
            {#if editor.failures[current]}<p
                role="alert"
                class=".rounded-lg .bg-red-950 .p-3 .text-xs .text-red-100"
              >
                {editor.failures[current]}
              </p>{/if}
            {#if preview}<p class=".text-[11px] .text-gray-400">
                Mock cleanup preview · no objects or colors were changed.
              </p>{/if}
            <div
              bind:this={thumbnails}
              class=".flex .gap-2 .overflow-x-auto .pb-1"
              aria-label="Photo thumbnails"
            >
              {#each photos as source, photoIndex (source)}
                <button
                  type="button"
                  data-photo-index={photoIndex}
                  aria-label={`View photo ${photoIndex + 1}`}
                  aria-current={photoIndex === index ? 'true' : undefined}
                  onclick={() => goTo(photoIndex)}
                  class=".relative .h-14 .w-20 .shrink-0 .overflow-hidden .rounded-md .border-2 {photoIndex ===
                  index
                    ? '.border-white .opacity-100'
                    : '.border-transparent .opacity-50 hover:.opacity-90'} focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
                  ><PhotoFrame
                    src={source}
                    onUnavailable={removePhoto}
                    alt={`Thumbnail ${photoIndex + 1}`}
                    thumbnail
                  /></button
                >
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <aside
        class=".flex .min-h-0 .flex-col .border-l .border-gray-100 .bg-white lg:.shrink-0 lg:.border-l-0"
      >
        <div class=".flex-1 .overflow-y-auto .p-6 lg:.hidden">
          <PropertyInfo {property} />
        </div>
        <details class=".hidden .px-4 .py-3 lg:.block">
          <summary class=".cursor-pointer .py-1 .text-sm .font-semibold"
            >Property details · {property.area ?? '—'} m² · {property.cityName}</summary
          >
          <div class=".py-4"><PropertyInfo {property} /></div>
        </details>
        <div class=".space-y-3 .border-t .border-gray-100 .p-5 lg:.p-4">
          {#if actionError}<p
              role="alert"
              class=".rounded-lg .bg-red-50 .p-3 .text-xs .text-red-800"
            >
              {actionError}
            </p>{/if}
          <button
            type="button"
            disabled={!!action}
            onclick={() => submit('apply')}
            class=".w-full .rounded-xl .bg-primary .px-4 .py-3 .text-sm .font-medium .text-white hover:.bg-primary-950 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-offset-2 focus-visible:.outline-primary disabled:.opacity-50"
            >{action === 'apply'
              ? 'Sending application…'
              : 'Apply for this home'}</button
          >
          <div class=".grid .grid-cols-2 .gap-2">
            {#if safeListingUrl}<a
                href={safeListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                class=".rounded-lg .border .border-gray-200 .px-3 .py-2.5 .text-center .text-xs .font-medium hover:.bg-gray-50 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-primary"
                >Open listing ↗</a
              >{/if}
            <button
              type="button"
              disabled={!!action}
              onclick={() => submit('dismiss')}
              class=".rounded-lg .bg-gray-100 .px-3 .py-2.5 .text-xs .font-medium .text-gray-600 hover:.bg-gray-200 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-primary disabled:.opacity-50"
              >{action === 'dismiss' ? 'Saving…' : 'Not interested'}</button
            >
          </div>
          <p class=".text-center .text-[10px] .leading-relaxed .text-gray-400">
            Demo actions · no real application is sent.
          </p>
        </div>
      </aside>
    </div>
    <span class=".sr-only" role="status" aria-live="polite"
      >{photos.length
        ? `Photo ${index + 1} of ${photos.length}`
        : 'No photos'}</span
    >
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: #141719;
  }
</style>
