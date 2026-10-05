import { t, Elysia } from 'elysia'
import { corePlugin } from '@/plugins'
import { mockRemovedItems } from '~core/photo-cleanup'

export const cleanPropertyImageHandler = new Elysia().use(corePlugin).post(
  '/properties/cleanImage',
  ({ body }) => ({
    mock: true as const,
    removedItems: mockRemovedItems(body.image.name),
  }),
  {
    body: t.Object({ image: t.File({ format: 'image' }) }),
    response: t.Object({
      mock: t.Literal(true),
      removedItems: t.Array(t.String()),
    }),
  },
)
