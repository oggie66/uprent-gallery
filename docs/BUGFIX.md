# Why the email list was slow

Every list request fetched complete MIME messages, including ordinary attachment bodies, then buffered and parsed everything. The supplied 20-message mailbox contains about 277 MB of full-message data, while the API response is only about 26 KB. Most of that transfer was discarded after extracting attachment metadata.

The backend now fetches headers and MIME BODYSTRUCTURE first, identifies display text and inline resources, and requests only those body sections plus attachment MIME headers. The existing parser still handles encoded headers, charsets, nested multipart messages, and inline CID images. Messages with matching layouts share a FETCH command. Mailboxes open read-only, concurrent identical requests are coalesced, failures propagate, and connection lifetime is bounded.

The measured request dropped from 18.72 seconds to 1.71 seconds (about 11× faster). All 20 emails retained identical displayed content, subjects, senders, dates, flags, and order. No email frontend files changed.

One explicit metadata tradeoff: when a skipped attachment lacks a declared decoded size, its `size` is the server-reported encoded byte count rather than exact decoded bytes. The existing UI does not display attachment sizes. Exact decoded sizes for arbitrary transfer encodings generally require fetching the attachment payload, which would reintroduce the bottleneck.
