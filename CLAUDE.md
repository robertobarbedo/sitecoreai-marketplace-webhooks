# Webhooks — notes for Claude Code

## Do NOT run or test this app standalone

SitecoreAI Marketplace apps **cannot run as standalone web apps**. The
Marketplace SDK (`ClientSDK.init({ target: window.parent })`) requires the app
to be embedded in an iframe inside SitecoreAI — outside of it, initialization
hangs/fails and every page is non-functional. The `/api/edge/*` routes also
require real Edge administration credentials to return anything useful.

Therefore: **do not start the dev server, open the app in a browser, or
attempt runtime testing.** Verification is limited to:

- `npm run build` (type-check + lint + compile) must pass
- Manual testing happens only inside SitecoreAI after the app is registered
  in Developer Studio (fullscreen extension point → the root route `/`)

## What this app does

One tabbed UI for both webhook systems of an environment:

- **SitecoreAI Authoring Webhooks** tab: webhook definition items under
  `/sitecore/system/Webhooks`, managed entirely client-side over the
  Marketplace SDK's authoring GraphQL (`src/utils/xm-webhooks.ts`). No
  credentials needed — the SDK carries them.
- **Exp. Edge Webhooks** tab: Experience Edge webhooks via the Edge Admin
  API, which needs stored Edge administration credentials. This half is
  ported from `sitecoreai-marketplace-experience-edge-admin-console`
  (webhooks only — its cache/settings tabs were deliberately not carried
  over).

## Project facts

- Based on the marketplace starter kit; only the **fullscreen** extension
  point is used, served from the root route (`src/app/page.tsx`).
- All sibling folders under `C:\Marketplace` are reference material only —
  never modify them.
- **XM webhook items**: template `{F05212CE-30A7-4733-A7F4-ED6E13F26692}`,
  fields `URL`, `Events` (pipe-separated event type GUIDs), `Enabled`
  (`"1"`/`""`), `Description`, `Authorization` (id of an Authorization item
  under `/sitecore/system/Settings/Webhooks/Authorizations`, template
  `{950542DA-E851-4996-A20A-89B40309F130}`, fields Key/Value/"Add to":
  Header). Conventions confirmed on a live instance by the Webhook Relay
  sibling app. `Rule` is deliberately never touched (out of scope; the UI
  only badges "Has rule") and item names are never changed after creation.
  Deleting a webhook leaves linked Authorization items in place — they can
  be shared.
- **Event types are discovered at runtime** by recursively walking
  `/sitecore/system/Settings/Webhooks/Event Types` (folders = categories,
  leaves = events, depth-capped at 4; `src/utils/webhook-events.ts`). Never
  hardcode the event list. Webhook items store event GUIDs, not names —
  compare ids through `normalizeItemId` (braces/case vary by source). Edits
  preserve stored event ids the walk did not surface.
- **Edge credentials** (Edge admin Client ID/Secret) are stored in the
  Sitecore content tree at
  `/sitecore/system/Modules/Marketplace/Webhooks/Settings`, JSON in the
  `Value` field (same pattern as the sibling apps). Loads fall back to the
  Experience Edge Admin Console's item
  (`LEGACY_SETTINGS_ITEM_PATH` in constants.ts) so tenants that configured
  that app are connected here out of the box; saves always write this app's
  own path and ensure the folders exist. That fallback only decrypts when
  this deployment uses the **same `EDGE_SECRET_ENCRYPTION_KEY`** as the Edge
  Admin Console deployment — with a different key the stored cipher fails as
  `secret_unreadable`, the settings modal opens, and re-entered credentials
  are saved under this app's own path (graceful, but worth knowing).
- The Client Secret is **sealed server-side** (AES-256-GCM, key from the
  required `EDGE_SECRET_ENCRYPTION_KEY` env var — see
  `src/lib/edge/secret-crypto.ts`). Only the ciphertext reaches the content
  tree, the browser, and the `x-edge-client-secret` header; the settings
  dialog never prefills or reveals it. Stored payload is `version: 2`
  (`secretCipher`). The seal format is `v2.` with the **client ID as GCM
  AAD**, so a cipher only opens next to the client ID it was sealed for;
  changing the Client ID in settings requires re-entering the secret.
  `readCredentials` (request.ts) accepts ONLY `v2.` ciphers; the validate
  route is the one place that takes plaintext or the unbound `v1.` format
  (ours before 2026-10-24, or the Edge Admin Console's) and returns a `v2.`
  cipher — the page's migration effect uses it on load for both
  `version: 1` plaintext items and `v1.` ciphers.
  Never add a plaintext fallback — missing key must fail the save.
- **API auth**: `src/middleware.ts` runs `requireSitecoreUser` on every
  `/api/*` route; `useEdgeApi` calls them with `authedFetch`.
  `src/lib/marketplace-auth/` is a copy of the shared kit (master in
  content-publish-inspector) — keep it byte-identical. The page is wrapped
  in a non-blocking `MarketplaceAuthProvider` (`AuthBoundary` in page.tsx),
  so the Authoring tab never waits for sign-in.
- **Webhook test route is SSRF-guarded**: it calls the endpoint through
  `publicHttpsRequest` (`src/lib/edge/public-https.ts`, a thin wrapper over
  `safeRequest` in `src/utils/ssrfGuard.ts` — the shared guard, kept
  byte-identical across apps) — https on 443 only, IP-literal hosts refused,
  every resolved address must be public unicast per ipaddr.js (allowlist;
  checked inside the socket's own DNS lookup, so no DNS-rebinding gap), no
  redirects followed, 15 s timeout, response read capped. Never switch it
  back to plain `fetch`.
- Browser → own Next.js `/api/edge/*` routes → OAuth token
  (`auth.sitecorecloud.io`, client_credentials, audience
  `https://api.sitecorecloud.io`) → Admin API
  (`edge.sitecorecloud.io/api/admin/v1`). Tokens are cached server-side only.
- UI: Tailwind CSS v4 + Radix UI + CVA (Blok design language, NOT shadcn).
  UI primitives copied from the edge-admin-console reference app; styling
  follows `C:\Marketplace\STYLE-GUIDE.md`. The Button has no
  `variant="destructive"` — use `colorScheme="danger"`.
