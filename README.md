# Torcida

## This release

- About > Download backup exports the complete collection, including saved journal photos. Restore backup previews counts and requires an explicit replacement confirmation. The current collection downloads before replacement. Files are private to the user, not uploaded to a server.
- One verified `tc_collection_v1` snapshot saves all collection sections together. Existing legacy keys remain untouched during migration. A save failure restores the previous saved state and retains a downloadable unsaved snapshot. Retry saves that snapshot and reloads the page. New writes cannot replace an unresolved unsaved snapshot. Another tab's newer saved snapshot blocks a stale write.
- Existing unreadable data is never automatically overwritten. Download recovery data before explicitly restoring a valid backup. Browser storage remains device-specific. Accounts and automatic cloud synchronization are not part of this release.
- All nine AI feature calls share response parsing, normalization and validation in `assets/data.js` and `assets/ai-client.js`. The server validates responses too. Partial responses, invalid types and upstream errors produce readable messages.
- The API enforces request sizes, one user message, supported image formats, supported feature names, feature-specific output limits and a fixed server-side model. Client tools, streaming, arbitrary model selection and other unsupported API settings are discarded.

## Required Vercel setup BEFORE merging/deploying

Keep the existing `ANTHROPIC_KEY` secret. `CLAUDE_MODEL` remains optional.

Create an Upstash Redis database and add its REST credentials as Vercel environment variables for Production and Preview:

| Variable | Value |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST URL from the database dashboard |
| `UPSTASH_REDIS_REST_TOKEN` | REST token, saved as a secret |

Use a shared database for all instances of the app. Production and preview deployments using that database share daily limits. Use a separate database for previews if you need independent test allowances.

The Vercel Marketplace integration may instead supply `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The app accepts these directly, so credentials do not need to be copied. Do not use the read-only token: rate limits require writes.

Production/hosted AI calls intentionally return a setup message until these variables exist. A Redis outage also pauses AI calls. Local collections, backups and journaling continue to work. There is no unprotected production fallback to per-instance counters.

After changing Vercel environment variables, create a new deployment. Test the preview before merging the pull request. An older HTML file copied by itself is no longer a complete app: deploy `index.html`, `assets/`, and `api/` together. The dated HTML copy is archival and should not be used as the entry point.

### Usage limits

| Optional variable | Default | Maximum |
| --- | --- | --- |
| `AI_REQUESTS_PER_MINUTE` | 10 per IP per UTC minute | 60 |
| `AI_REQUESTS_PER_DAY` | 100 per IP per UTC day | 1,000 |
| `AI_DAILY_REQUEST_LIMIT` | 500 requests across the app per UTC day | 10,000 |
| `AI_DAILY_TOKEN_BUDGET` | 250,000 reservation units across the app per UTC day | 10,000,000 |

Redis reserves all four counters in one atomic Lua command and expires the keys. Requests reserve UTF-8 text bytes, a conservative fixed image allowance when relevant, output-token allowance and an overhead allowance. This is a conservative application allowance, not an exact token bill or a dollar spending cap. Failed/aborted requests do not refund their reservations because upstream work may already have incurred usage. Limits reset at UTC boundaries and return `Retry-After`. Set provider billing limits/alerts separately if available in your provider account. Logs and Redis keys do not contain prompts, collections or raw IP addresses.

The in-memory limiter is for non-Vercel, non-production local development only. IP limits can affect people on a shared network. Global limits remain effective even if an IP changes. Deployments on other hosts must use `NODE_ENV=production` to require durable controls.

### Optional private beta access code

Set `TORCIDA_ACCESS_CODE` to a long, random secret to require an access code for all AI calls. The app asks for it on the first denied request, remembers it in session storage, and asks the user to retry. The code is sent in a header, never in a URL or backup. Share it privately with testers. This is a shared beta gate, not individual user accounts. Leave it unset for public access protected by the usage controls. Do not put API keys or the access code in frontend code.

## Validation

Run with Node 20+:

```
node --test tests/*.test.cjs
```

Tests cover migration, photo-inclusive backups, failed saves, recovery, restore confirmation, stale-tab conflicts, corrupted storage, malformed AI responses, all nine request paths, server caps, access checks, rate limits, global allowances and fail-closed Redis behavior. API requests in tests use mocked provider responses and a mocked Redis transport. A real Redis integration and live provider request still need a configured deployment.


## Visual and mobile update

- Five persistent destinations: Find, Humidor, Bar, Journal and Guide. Settings/About and backup controls are reached with the header settings button. Hash navigation supports browser Back and home-screen shortcuts.
- Ivory surfaces, walnut header, brass accents, stronger contrast, native system text for controls, consistent line icons and larger touch targets.
- Guide silhouettes use one physical scale for inches and ring gauge. The comparison panel keeps that scale across both selected shapes. Sizes are representative and vary by brand. Cut illustrations show the tool, a schematic cut location, and the resulting cap opening.
- Zoom remains enabled. Safe-area insets, dynamic visual-viewport sizing, keyboard handling, modal focus containment/return, native chip buttons, labels and reduced-motion behavior improve mobile use.
- Camera/gallery images are resized and re-encoded as JPEG before AI requests. Journal photos use a smaller size ceiling. Undecodable formats show an actionable message. This does not promise native HEIC decoding in browsers that do not support it.
- Journal dates use the local calendar date. Sharing uses native file/text sharing where available, then copy text. The app includes a manifest, maskable and Apple icons, and a service worker for the offline collection shell. AI requests always require a network and are never cached. Offline protection does not replace downloaded backups.
- `tests/responsive.html` is an internal preview harness with common narrow widths, tablet/landscape sizes, overflow checks and touch-target checks. It is not a real iOS or Android emulator. Hardware camera, operating-system share sheets, installation, background behavior and safe-area/keyboard behavior still require real-device verification.
