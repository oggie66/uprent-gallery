/** Fixed demo scenarios, not image analysis. Unknown photos use the no-op case. */
const scenarios: Record<string, string[]> = {
  '1b6a945bfff7206ec0aaafa4b2ce0c38.jpg': ['bottles', 'rags'],
  'c71e7c64083400f542385d1e5f4559ca.jpg': ['consumable items'],
  'a72e7a3ee2fa1ec6c9f1590ffef6811d.jpg': ['humans', 'pets', 'bottles'],
}

export const mockRemovedItems = (filename: string): string[] => [
  ...(scenarios[filename] ?? []),
]

export const cleanupNotice = (items: string[]): string =>
  items.length
    ? `removed ${new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items)} from the photo`
    : 'nothing was removed'
