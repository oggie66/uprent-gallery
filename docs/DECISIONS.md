# Implementation decisions

Source: https://uprent.notion.site/test-task-uprent-mini

All work remains local for the owner to review and publish. This log tracks the problem, decision, alternatives, risks, and verification per task.

# 0. Setup

- **Problem:** The initial shared TypeScript configuration used classic module resolution, and the database barrel did not export the existing property schemas. Baseline lint failed in three packages.
- **Decision:** Set Node module resolution in the shared configuration and export the existing schemas. Keep Bun 1.2.16, Svelte 5, and all existing dependency versions.
- **Alternatives:** Upgrade the framework or rewrite imports individually. Neither addresses the configuration problem cleanly.
- **Git:** Back up original history and initialize an independent local `main` repository. Do not publish or push.

# 2.1. Debug slow email loading

- **Problem:** Loading the provided 20-message mailbox took 18.72 seconds. The implementation fetches every complete MIME message, downloads attachment payloads, buffers them, and parses them before returning only attachment metadata. It also permits overlapping mailbox operations on a shared connection and ignores mailbox-open errors.
- **Decision:** Fetch headers and BODYSTRUCTURE, select displayable text parts plus inline content required by HTML, and omit ordinary attachment payloads. Continue using the existing MIME parser for charset, transfer-encoding, and encoded-header decoding. Keep the email frontend unchanged.
- **Alternatives:** Cache full messages (does not fix the first load), change the email server (the brief excludes it), paginate/change the frontend (also excluded), or strip all attachments including inline images (changes visible email content).
- **Security:** Open mailboxes read-only; do not mark messages seen or expunge them. Retain TLS verification. Keep credentials out of new logs and test fixtures. Existing HTML rendering remains unchanged by this scoped backend fix.
- **Scaling:** Bound processing and avoid downloading ordinary attachment bodies. The unchanged API still returns the whole mailbox, so response size remains linear in the number of emails.
- **Verification:** Eight regression tests pass; live comparison and metadata tradeoffs are recorded below.

# 2.2.1. Photo gallery

- **Decision:** Use a full-screen native dialog, an image stage, previous/next and keyboard controls, a compact thumbnail strip, direct photo-number navigation, and an optional thumbnail overview. Lazy-load thumbnails and only display the selected full-size image. Support empty, single-image, broken-image, and large galleries.
- **Alternatives:** Add a carousel library or show every full-size image at once. The former violates the brief and the latter scales poorly.

# 2.2.2. Source attribution

- **Decision:** Keep a visible source banner linked to the original listing. Treat attribution as provenance; do not claim it grants image rights.

# 2.2.3. House information

- **Decision:** Display address, city, monthly rent, floor area, bedrooms, and key available details. Use a collapsible details panel on narrow screens to preserve image space.

# 2.2.4. Original listing

- **Decision:** Use a clearly labeled link opening the listing in a new tab, with `noopener noreferrer`.

# 2.2.5. Apply

- **Decision:** Call the provided local mock endpoint, disable duplicate actions while pending, close only on success, and retain the gallery with a retryable error on failure. Keep a success notice on the underlying page.

# 2.2.6. Not interested

- **Decision:** Follow the same asynchronous action lifecycle as Apply, without sending both operations concurrently.

# 2.2.7. Clean photo

- **Decision:** Clean only the selected original image. Associate pending work and results with that image; keep the original available for comparison. Clearly label the generated preview, let users navigate while it processes, and provide cancellation/error recovery. Revoke generated object URLs when the gallery closes.
- **Alternatives:** Replace the original irreversibly, clean every photo up front, or imply the preview depicts the actual property's condition. These undermine trust or waste work.
- **Scaling:** Limit active image-cleaning work to one request; cache completed previews for the current gallery session.
- **Verification:** Implemented and reviewed on desktop and mobile; see detailed verification below.

# 0.1. Development ports, runtime, and lint behavior

- **Problem:** The original web port conflicts with macOS Control Center, and both task repositories use the same API port. Gallery's Vite version requires a newer Node compatibility level than the pinned Bun runtime reports. The root lint command also reinstalled dependencies on every run.
- **Decision:** Use web 5174 and API 5003; run Vite with Node and retain Bun for the API. Declare the supported Node range. Make lint non-mutating and add a discoverable `test` script.
- **Alternatives:** Stop a system service, accept changing fallback ports, or upgrade all dependencies. Separate explicit ports and the already-installed Node runtime are smaller and predictable.
- **Environment repair:** A repeated Bun install left a hardlinked esbuild executable that macOS killed. Byte-identical fresh copies ran successfully and retained valid code signatures; no security setting or dependency version was changed.

# 2.1.1. MIME decoding and attachment metadata

- **Decision:** Preserve the MIME tree, fetch each leaf's MIME headers, retain ordinary display text and inline resources, and leave regular attachment payloads empty when parsing. Reuse the existing parser rather than writing charset/base64/quoted-printable/header decoders.
- **Alternatives:** Flatten all text parts (can duplicate plain/HTML alternatives), fetch only the first text section (breaks nested mail), or strip all images (changes visible content).
- **Metadata tradeoff:** BODYSTRUCTURE reports encoded octets, not generally exact decoded file sizes. Use an optional declared decoded size when available, otherwise preserve the server-reported encoded size as an upper bound. No approximate base64 arithmetic is presented as an exact decoded size. The current frontend never renders attachment sizes.
- **Verification:** The before/after API comparison preserves all visible email fields. Sixteen messages differ only in attachment metadata. Synthetic tests preserve nested alternatives, non-ASCII content, and CID image output.

# 2.1.2. Mailbox lifecycle and bounded work

- **Decision:** Coalesce simultaneous loads for the same credential pair using a hashed key. Each active load owns its connection; do not reuse a mutable selected mailbox across requests. Read INBOX without marking seen, process batches of 100 messages, group identical section requests, wait for streams as well as FETCH completion, and cap each load at 30 seconds.
- **Alternatives:** Keep the original unguarded connection pool, start an unbounded fetch per message, or cache stale mailbox results. These introduce races, excessive work, or misleading speed improvements.
- **Security:** Keep TLS checks, avoid new credential logging, and do not change message flags or expunge. The existing email frontend renders HTML directly; robust isolation/sanitization remains a separate production concern and was not changed under the brief's frontend restriction.
- **Scaling:** The response remains O(number of messages) because the existing frontend requests the whole inbox. Inline resources still require their bytes to preserve displayed content. Pagination, persistent UID-aware caching, and attachment downloads would be follow-up product/API changes.
- **Verification:** A live uncached request improved from 18.72 s to 1.71 s. Tests cover error propagation, missing body sections, and stream/FETCH completion ordering.

# 2.2.1.1. Gallery navigation, accessibility, and unavailable images

- **Decision:** Keep a single selected full-size image, native modal focus behavior, labeled controls, live photo-position announcements, keyboard arrows/Home/End, and horizontal swipe with a vertical-gesture threshold. Combine lazy thumbnails, overview, and direct number entry. Clamp number entry to valid integer indexes and commit on blur or Enter.
- **Alternatives:** A long row of dots or eagerly loading every full-size image becomes unusable for 100+ pictures. A custom modal/focus trap or carousel package adds unnecessary code/dependencies.
- **Decision:** Keep zero/single-image states and explicit retryable broken-image placeholders. The supplied fixture lists 16 files but provides only 7, so hiding unavailable photos would conceal the data problem and change positions.
- **Verification:** Browser-tested zero, one, and 120-photo fixtures, jumping to 120, fractional input, keyboard navigation, Escape, and missing files. Temporary fixture routes are removed from the deliverable.

# 2.2.2.1. Attribution and external links

- **Decision:** Show the source alongside the photo stage. Link attribution and Open listing to the supplied listing URL only when its scheme is HTTP(S); use `noopener noreferrer` for new tabs.
- **Alternatives:** Omit attribution, bury it inside a details panel, or treat arbitrary URL schemes as navigation targets.
- **Security/legal:** A source banner identifies provenance; it does not itself confer permission to reuse third-party photographs.

# 2.2.3.1. Information hierarchy and responsive layout

- **Decision:** Prioritize title, city, monthly rent, area, bedrooms (including estimated status), and energy label. Include furnishing, availability, deposit, service costs, and the short description when present. Desktop uses a side panel; mobile uses expandable details below the image stage.
- **Alternatives:** Display every data field or cover the image with a permanent mobile sidebar. Both reduce clarity.
- **Verification:** Inspected at desktop size and 390 × 844; no horizontal overflow. The property model's `serviceCosts` can be a number or `no`, so money formatting is type-guarded.

# 2.2.5–2.2.6.1. Property-action lifecycle

- **Decision:** Permit one property action at a time. Keep the gallery open until the API confirms success; disable duplicate actions and closing while the request is pending. Use a 15-second timeout, keep errors visible for retry, and show a confirmation on the underlying page after success.
- **Alternatives:** Close optimistically, fire both actions concurrently, or leave failures only in console logs. These obscure whether the action succeeded.
- **Verification:** Both supplied mock endpoints were exercised through the browser and closed successfully with the expected confirmation. No real housing applications were sent.

# 2.2.7.1. Generated previews and async ownership

- **Decision:** Key preview state by original image URL, retain the source, offer explicit original/preview comparison, and label generated output as potentially different from actual property condition. One cleaning request may run at a time; navigation remains available, cancellation aborts the request, and the request has a 30-second timeout. Revoke object URLs on close and ignore late results after disposal.
- **Alternatives:** Associate results with a mutable slide index, overwrite the original, clean the whole gallery, or retain unlimited previews across closed sessions. These cause wrong-image updates, loss of trust, or resource growth.
- **Security/scaling:** Use the existing image endpoint and image response validation. The supplied server's large upload limit and image-decoding cost remain production hardening concerns; generated previews are scoped to one open gallery session.
- **Verification:** A real local clean-image request succeeded. Browser comparison restored the original, and navigation did not mix preview state between photos.

# 2.1.3. Owner choice: attachment-size precision

- **Context:** The owner was asked to choose between the documented fast path and preserving exact decoded attachment sizes at the cost of fetching attachment data.
- **Owner decision:** Keep fast loading and document the attachment-size semantics. The implementation retains the fast metadata behavior, and the README, bug explanation, and verification record describe its precision limit.

# 2.2.5–2.2.6.2. Offline recovery

- **Problem:** A real API-offline browser check exposed a raw `Failed to fetch` message.
- **Decision:** Keep the gallery open, clear the pending state, and explain that the action did not complete and the local API should be checked. Distinguish timeouts from ordinary failures. Apply the same clear network-message treatment to photo previews.
- **Verification:** Stopped the task's local API, exercised Apply, confirmed that the dialog remained visible, and restarted the API.

# 2.5. Omit unavailable photos

- **Problem:** The supplied fixture referenced nine missing image files, so the gallery displayed unavailable slides and thumbnails.
- **Decision:** Remove nonexistent file references from the demo fixture, leaving its seven actual photos in their original order. Additionally, when a gallery image fails at runtime, remove its URL from slides, overview, and thumbnails; preserve the current photo where possible, clamp the index, and update the launch-card count. Failed generated previews return to the original instead of removing a valid original photo.
- **Alternatives:** Hiding only the unavailable label leaves blank slides and incorrect counts. Preloading every full-resolution image would delay opening and defeat lazy thumbnail loading. Runtime removal handles later failures without that overhead.
- **Verification:** Browser review shows seven photos in the launch card, gallery counter, thumbnails and overview. Svelte/TypeScript checks passed; formatting and production build checked after the edit.

# 2.6. Make gallery navigation circular

- **Decision:** Wrap previous/next navigation with modulo indexing. Buttons, arrow keys, and swipes share the same step function. Both arrows stay enabled when there are at least two photos.
- **Alternatives:** Wrapping all numeric jumps would make invalid photo-number input surprising. Direct number entry remains bounded; Home and End still select the first and last photo. Empty galleries remain guarded and single-photo galleries hide the arrows.
- **Verification:** Browser checks confirmed Previous from photo 1 reaches photo 7, Next returns to photo 1, and both keyboard directions also wrap. Svelte/TypeScript checks pass.

# 2.7. Allocate 30% of viewport width to property details

- **Decision:** Replace the fixed 320-pixel desktop sidebar with a 30vw grid column. The photo area takes the remaining width. Preserve the existing stacked layout on smaller screens.
- **Alternatives:** A fixed sidebar width does not maintain the requested ratio across desktop sizes.
- **Verification:** Browser measurement at a 1280-pixel viewport reports a 384-pixel details panel: exactly 30%.

# 2.8. Replace misleading mock cleanup with an explicit AI integration boundary

- **Problem:** The task-supplied cleanImage endpoint did no AI editing. It increased contrast by 0.4 and stamped Imagine this is a cleaned photo onto the result. The owner now requires real clutter removal and no global color changes.
- **Decision:** Remove the contrast/stamp mock. Until an AI provider is selected and configured, return a clear service-unavailable response and preserve the original. Asked the owner to choose the provider because it determines credentials, image transmission, and costs.
- **Decision:** Define separate cleaned and unchanged success outcomes. The frontend shows Nothing to clean up was detected only for an explicit unchanged result, creates no generated preview in that case, and dismisses the toast after six seconds or on request. Configuration failures never masquerade as clean photos.
- **Required cleanup policy for the upcoming integration:** Remove humans, pets, consumables, bottles, rags, and incidental surface clutter. Preserve furniture, fixtures, architecture, permanent decor, crop, geometry, lighting, saturation, white balance, contrast, and overall palette. Analyze first; return unchanged if there are no targets. Use localized edits and preserve original pixels outside the edited areas where supported; prompts alone cannot guarantee pixel-identical colors.
- **Alternatives:** A saturation/contrast filter cannot remove objects. Returning the unchanged original as a successful cleanup without analysis would falsely imply detection. No provider was silently chosen and no paid API call was made.
- **Status:** Superseded by §2.9: the owner chose mock-only behavior, so no AI integration is planned for this iteration.


# 2.9. Keep photo cleanup as an explicit mock

- **Problem:** The owner wants to validate cleanup feedback without any real AI, object detection, or palette changes.
- **Decision:** Return deterministic removed-item lists keyed by fixture filename. Photo 1 reports bottles and rags, photo 3 consumable items, and photo 4 humans, pets, and bottles. All other filenames return an empty list. These are canned scenarios, not claims about the image contents.
- **Decision:** Show “removed bottles and rags from the photo” (with the returned items) or exactly “nothing was removed”. A separate Mock label identifies simulated results. Toasts dismiss after six seconds and can be closed manually.
- **Decision:** Preserve the original image bytes in mock previews; no objects, saturation, contrast, or other colors actually change. Label previews accordingly.
- **Alternatives:** Real AI was explicitly declined. Restoring the contrast filter would violate palette preservation. Random mock results would make manual validation inconsistent.
- **Scaling:** No provider credentials, external AI requests, or AI costs. Only the current photo uses the existing local endpoint; previews are released when the gallery closes.
- **Verification:** Unit tests cover fixed removal and no-op scenarios and exact toast wording. Manually validate photo 1 for a removal list and photo 2 for the no-op toast.


# 2.10. Simulate cleanup progress over the photo

- **Problem:** Instant mock results did not convey cleanup in progress.
- **Decision:** Show a centered spinner and translucent blurred overlay on the active photo for at least two seconds, then reveal the unchanged mock preview and result toast. The local request runs during that interval; slower requests keep the loader visible until completion.
- **Decision:** Keep navigation and cancellation available. Only the photo being cleaned receives the overlay. Canceling or closing the gallery clears the pending delay, and reduced-motion preferences disable spinner rotation.
- **Alternatives:** A server-side delay would slow every API consumer. A permanent image filter would alter the photo; a temporary backdrop blur preserves the original bytes and palette.


# 2.11. Prevent selection of gallery chevrons

- **Problem:** Repeated clicks or dragging could select the arrow characters in gallery navigation.
- **Decision:** Apply the prefixed Tailwind `.select-none` utility to both arrow buttons, preserving their click handlers, accessible labels, and keyboard focus.
- **Alternatives:** Replacing the glyphs with SVGs adds unnecessary markup; suppressing mouse events could interfere with navigation.


# 2.12. Allow cleanup only once per photo

- **Problem:** A no-op result left the cleanup action available, allowing repeated cleanup of an already processed photo.
- **Decision:** Track successful completion separately from preview availability, keyed by source URL. Both removal and no-op results permanently replace the cleanup button with Show original for the current page session, including after navigating away or reopening the gallery. The follow-up in §2.13 enables switching back to the cleaned preview. Failed or cancelled requests remain retryable.
- **Alternatives:** Checking preview existence alone misses no-op results. Persisting mock completion across browser sessions would add unnecessary storage for this demo.


# 2.13. Toggle between original and cleaned photo

- **Problem:** Showing the original disabled comparison back to the completed cleanup result.
- **Decision:** Toggle the button between Show original and Show cleaned up photo. Reuse the existing preview without calling cleanup again; the completion guard remains in place. Mock images remain unchanged, including no-op results.
- **Alternatives:** Re-running cleanup wastes work and violates the one-time action requirement.
