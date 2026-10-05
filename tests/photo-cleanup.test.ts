import { expect, test } from 'bun:test'
import {
  cleanupNotice,
  mockRemovedItems,
} from '../packages/~core/photo-cleanup'

test('cleanup mock has deterministic removal and no-op scenarios', () => {
  expect(mockRemovedItems('1b6a945bfff7206ec0aaafa4b2ce0c38.jpg')).toEqual([
    'bottles',
    'rags',
  ])
  expect(mockRemovedItems('57bda0054c5f93a8398544c825d33b8e.jpg')).toEqual([])
  expect(mockRemovedItems('unknown.jpg')).toEqual([])
})
test('toast names removed items or reports nothing removed', () => {
  expect(cleanupNotice(['bottles', 'rags'])).toBe(
    'removed bottles and rags from the photo',
  )
  expect(cleanupNotice(['humans', 'pets', 'bottles'])).toBe(
    'removed humans, pets, and bottles from the photo',
  )
  expect(cleanupNotice([])).toBe('nothing was removed')
})
