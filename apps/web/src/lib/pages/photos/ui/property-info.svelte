<script lang="ts">
  import type { BasePropertySchema } from '~core/database'
  let { property }: { property: BasePropertySchema } = $props()
  const money = (value: number) =>
    new Intl.NumberFormat('en-NL', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value)
</script>

<div class=".space-y-5">
  <div>
    <p
      class=".mb-1 .text-xs .font-semibold .uppercase .tracking-widest .text-primary"
    >
      A place to call home
    </p>
    <h2 class=".text-2xl .font-semibold .leading-tight">{property.title}</h2>
    <p class=".mt-1 .text-sm .text-gray-500">{property.cityName}</p>
  </div>
  {#if property.price != null}<p class=".text-2xl .font-semibold">
      {money(property.price)}
      <span class=".text-xs .font-normal .text-gray-500">/ month</span>
    </p>{/if}
  <dl class="!.grid .grid-cols-3 .gap-2 .rounded-xl .bg-gray-50 .p-3">
    {#if property.area != null}<div>
        <dt class=".text-[11px] .text-gray-500">Area</dt>
        <dd class=".mt-1 .text-sm .font-semibold">{property.area} m²</dd>
      </div>{/if}
    {#if property.extraFields?.bedrooms != null}<div>
        <dt class=".text-[11px] .text-gray-500">Bedrooms</dt>
        <dd class=".mt-1 .text-sm .font-semibold">
          {property.extraFields.bedrooms}{property.bedroomsEstimated
            ? ' (est.)'
            : ''}
        </dd>
      </div>{/if}
    {#if property.extraFields?.energyLabel}<div>
        <dt class=".text-[11px] .text-gray-500">Energy</dt>
        <dd class=".mt-1 .text-sm .font-semibold">
          {property.extraFields.energyLabel.toUpperCase()}
        </dd>
      </div>{/if}
  </dl>
  {#if property.extraFields?.propertyShortDescription}<p
      class=".text-sm .leading-relaxed .text-gray-600"
    >
      {property.extraFields.propertyShortDescription}
    </p>{/if}
  <dl class="!.grid .grid-cols-2 .gap-x-3 .gap-y-2 .text-xs">
    {#if property.extraFields?.interior}<dt class=".text-gray-500">
        Furnishing
      </dt>
      <dd class=".text-right .capitalize">
        {property.extraFields.interior}
      </dd>{/if}
    {#if property.extraFields?.availableSince}<dt class=".text-gray-500">
        Available
      </dt>
      <dd class=".text-right .capitalize">
        {property.extraFields.availableSince}
      </dd>{/if}
    {#if property.extraFields?.deposit != null}<dt class=".text-gray-500">
        Deposit
      </dt>
      <dd class=".text-right">{money(property.extraFields.deposit)}</dd>{/if}
    {#if typeof property.extraFields?.serviceCosts === 'number'}<dt
        class=".text-gray-500"
      >
        Service costs
      </dt>
      <dd class=".text-right">
        {money(property.extraFields.serviceCosts)} / mo
      </dd>{/if}
  </dl>
</div>
