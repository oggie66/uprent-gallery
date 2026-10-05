<script lang="ts">
  let {
    src,
    alt,
    thumbnail = false,
    onUnavailable,
  }: {
    src: string
    alt: string
    thumbnail?: boolean
    onUnavailable?: (source: string) => void
  } = $props()
  let failed = $state(false)
  let loaded = $state(false)
  let retry = $state(0)
  $effect(() => {
    void src
    failed = false
    loaded = false
  })
</script>

<div class=".relative .h-full .w-full .overflow-hidden">
  {#key `${src}:${retry}`}
    <img
      {src}
      {alt}
      loading={thumbnail ? 'lazy' : 'eager'}
      decoding="async"
      onload={() => (loaded = true)}
      onerror={() => {
        failed = true
        loaded = false
        onUnavailable?.(src)
      }}
      class=".h-full .w-full {thumbnail
        ? '.object-cover'
        : '.object-contain'} {failed ? '.invisible' : ''}"
    />
  {/key}
  {#if failed && !onUnavailable}
    <div
      class=".absolute .inset-0 .flex .flex-col .items-center .justify-center .gap-3 .bg-[#202529] .p-2 .text-center .text-gray-300"
    >
      <span class={thumbnail ? '.text-[10px]' : '.text-sm'}
        >{thumbnail ? 'Unavailable' : 'This photo is unavailable.'}</span
      >
      {#if !thumbnail}<button
          type="button"
          onclick={() => {
            failed = false
            retry++
          }}
          class=".rounded-lg .border .border-white/30 .px-4 .py-2 .text-sm focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-white"
          >Retry photo</button
        >{/if}
    </div>
  {:else if !loaded && !thumbnail}
    <div
      role="status"
      class=".pointer-events-none .absolute .inset-0 .flex .items-center .justify-center .text-sm .text-gray-400"
    >
      Loading photo…
    </div>
  {/if}
</div>
