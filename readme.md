# Uprent Gallery

A personal rental-property gallery and email viewer maintained by Ognjen Karagunovic.

## Run locally

Use Bun **1.2.16** and Node **20.19+ or 22.12+** (Node 24 was used for verification).

```sh
bun install --frozen-lockfile
```

Run in separate terminals from the repository root:

```sh
bun run --cwd apps/server dev
bun run --cwd apps/web dev
```

- Gallery: **http://localhost:5174/photos**
- Emails: **http://localhost:5174/emails**
- API: **http://localhost:5003**

The supplied email endpoint uses the task's test mailbox. The application needs network access to that IMAP server for live email verification. Tests use synthetic MIME fixtures and do not need credentials or network access.

These ports let this project run beside Uprent Mini (`5173` / `5002`) and avoid macOS Control Center's port `5000`. Vite runs under Node; the API uses Bun.

## Gallery behavior

- Full-screen, responsive dialog with keyboard arrows, Home/End, Escape, swipe navigation, thumbnails, an overview, and direct photo-number selection (blur or Enter to commit).
- Source attribution, property details, and a safe link to the original listing.
- Apply and Not interested use the provided **mock** endpoints. Success closes the gallery and leaves a confirmation on the page; failure keeps it open for retry.
- Clean photo uses fixed mock outcomes, with no AI calls or image changes. Photo 1 reports bottles and rags; photo 2 reports nothing removed; photo 3 reports consumable items; photo 4 reports humans, pets, and bottles. Other photos report nothing removed. Toasts identify the mock and list its removal result. Mock previews preserve the original bytes and colors.
- Empty galleries, a single photo, unavailable images, cancellation, and large galleries have explicit behavior.

The gallery fixture includes the 7 photos actually supplied. Photos that fail during viewing are removed from navigation, thumbnails, and counts.

## Verify

```sh
bun test
bun run lint:all
bun run --cwd apps/web build
```

Lint does not install packages or modify the dependency graph. No third-party packages were added.

- [Task-by-task decisions](docs/DECISIONS.md)
- [Email bug explanation](docs/BUGFIX.md)
- [Verification and performance evidence](docs/VERIFICATION.md)

All changes remain local. Nothing has been submitted or pushed to GitHub.
