<script lang="ts">
  import { mockProperty } from './lib/mock-property'
  import Gallery from './ui/gallery.svelte'
  import type { PropertyAction } from './lib/gallery-service'
  let photos = $state([...mockProperty.imageURLs])
  let open = $state(false)
  const completedCleanups = $state<Record<string, boolean>>({})
  let notice = $state('')
  const complete = (action: PropertyAction) => {
    notice =
      action === 'apply'
        ? 'Your demo application was sent.'
        : 'This property was marked as not interested.'
  }
</script>

<svelte:head><title>{mockProperty.title} · Uprent Gallery</title></svelte:head>
<main
  class=".flex .min-h-full .items-center .justify-center .bg-[#f5f3f0] .p-6"
>
  <article
    class=".w-full .max-w-lg .overflow-hidden .rounded-2xl .bg-white .shadow-lg"
  >
    <div class=".relative .aspect-[4/3] .overflow-hidden">
      <img
        src={mockProperty.previewImageURL}
        alt={`Living room at ${mockProperty.title}`}
        class=".h-full .w-full .object-cover"
      /><span
        class=".absolute .bottom-4 .left-4 .rounded-full .bg-white/95 .px-3 .py-1.5 .text-xs .font-medium"
        >{photos.length} photos · {mockProperty.platformName}</span
      >
    </div>
    <div class=".p-6">
      <p
        class=".text-xs .font-semibold .uppercase .tracking-widest .text-primary"
      >
        Take a closer look
      </p>
      <h1 class=".mt-2 .text-2xl .font-semibold">{mockProperty.title}</h1>
      <p class=".mt-1 .text-sm .text-gray-500">
        {mockProperty.cityName} · {mockProperty.area} m² · €{mockProperty.price}
        / month
      </p>
      <button
        type="button"
        onclick={() => (open = true)}
        class=".mt-5 .w-full .rounded-xl .bg-primary .px-4 .py-3 .text-sm .font-medium .text-white hover:.bg-primary-950 focus-visible:.outline focus-visible:.outline-2 focus-visible:.outline-offset-2 focus-visible:.outline-primary"
        >View gallery</button
      >{#if notice}<p
          role="status"
          class=".mt-4 .rounded-lg .bg-green-50 .p-3 .text-sm .text-green-900"
        >
          {notice}
        </p>{/if}
    </div>
  </article>
</main>
{#if open}<Gallery
    {completedCleanups}
    property={{ ...mockProperty, imageURLs: photos }}
    onPhotoUnavailable={source => {
      photos = photos.filter(photo => photo !== source)
    }}
    onClose={() => (open = false)}
    onComplete={complete}
  />{/if}
