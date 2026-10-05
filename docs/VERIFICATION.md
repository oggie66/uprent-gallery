# Verification

## Live email comparison

The task's test mailbox was accessed read-only through the local endpoint.

| Measure                   | Original implementation | Selective MIME fetching |
| ------------------------- | ----------------------- | ----------------------- |
| Messages returned         | 20                      | 20                      |
| HTTP response bytes       | 26,136                  | 26,136                  |
| End-to-end request time   | 18.72 s                 | 1.71 s                  |
| Full-message mailbox size | 277,016,958 bytes       | Not downloaded          |

This is one before/after observation, not a general latency guarantee. Network conditions and mailbox contents affect results. There is no full-mailbox result cache hiding first-load cost.

Compared every response field by UID. Content, subject, sender/recipients, dates, flags, categories, identifiers, references, and order match. Sixteen messages have attachment metadata differences because skipped attachment sizes use server transfer-byte counts when decoded sizes are unavailable. This tradeoff is described in the bug explanation and decision log.

## Regression tests

Eight Bun tests cover selective body-section requests, nested alternative MIME, UTF-8 and transfer-encoding decoding, attachment metadata without attachment bodies, plain-text messages, preserved CID images, attached text/forwarded messages, missing MIME sections, stream completion ordering, and FETCH errors.

## Browser verification

- Open/close and focus return in the native full-screen dialog.
- Original/generated-photo comparison, navigation, and labeled generated previews.
- Successful Apply and Not interested calls close the gallery and show confirmations. With the API deliberately stopped, Apply keeps the gallery open with a retryable error; the API was restored afterward.
- Zero-photo, one-photo, and 120-photo fixtures; direct jump to photo 120; fractional input bounded to a valid integer; Escape; End navigation; unavailable-photo state.
- Desktop and 390 × 844 mobile layout; mobile dialog and page width match the viewport without horizontal overflow.
- Temporary browser fixture routes are removed before handoff.

## Build and static checks

The web production build passes. TypeScript and Svelte checks pass with no application diagnostics. The final tests, full lint/formatting checks, and production build pass after fixture removal. Existing browser-support database age notices are informational; dependency versions were not upgraded for those notices.

## Mock photo cleanup

- 10 tests pass (22 assertions), including deterministic mock scenarios and exact toast wording.
- Browser verified photo 2: `nothing was removed`; photo 3: `removed consumable items from the photo`. Each toast carries a separate Mock label.
- Mock preview preserves the original image, with an explicit no-objects-or-colors-changed caption.
- Screenshot: `docs/screenshots/gallery-mock-cleanup.png`.

## Mock cleanup loading overlay

- Browser confirmed the blurred overlay and spinner appear on click, then disappear with the removal toast after approximately 2.07 seconds.
- Type checking, Svelte checks, and formatting pass.
- Screenshot: `docs/screenshots/gallery-cleanup-loader.png`.
