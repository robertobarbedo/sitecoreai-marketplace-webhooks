# Marketplace submission: Webhooks

Copy-paste text for Sitecore's public-app submission form, in form order.
Replace `{{APP_URL}}` with the production deployment URL before submitting.

## 1. App name

Webhooks

## 2. Headline

<!-- 355 chars -->

Manage both webhook systems of a SitecoreAI environment in one screen. List, create, edit, enable, disable and delete Authoring webhooks with their events and authorization items, and Experience Edge webhooks with their execution log and health, then fire manual test calls and see the status, latency and response, with Edge credentials stored encrypted.

## 3. Description

A SitecoreAI environment has two separate webhook systems. Authoring webhooks are definition items in the content tree, fired by authoring events such as item saves, publishes and workflow transitions. Experience Edge webhooks are registered through the Experience Edge Admin API and fire when content is published to Edge. Each is managed in a different place, and Edge webhooks have no UI at all. Webhooks brings both into one tabbed screen for admins and developers.

Authoring Webhooks tab:
- List every webhook item under /sitecore/system/Webhooks with URL, events, authorization and enabled state
- Create and edit webhooks: name, URL, description, events, authorization and enabled flag
- Event types are discovered at runtime and grouped by category, so new Sitecore event types appear without an app update
- Link an existing Authorization item or create one inline
- One-click enable/disable and delete with confirmation
- Webhooks with a Rule filter get a "Has rule" badge; rules are never changed

Experience Edge Webhooks tab:
- List, create, edit and delete Edge webhooks with label, URI, method, OnEnd / OnUpdate execution mode, headers, body and body-include
- Execution log and health: recent runs, consecutive-failure counts and a warning when Edge has auto-disabled a webhook
- Manual test calls with the configured method, headers and body, showing request, status, latency and response
- The Edge client secret is validated, sealed on the server and never shown again; existing Experience Edge Console credentials are reused automatically when both apps share an encryption key

Use cases:
- Wire up rebuild or integration webhooks for a new environment
- Diagnose a webhook that stopped firing
- Audit which webhooks exist and which events they listen to

## 4. Financial model

Free

## 5. Categories

Suggested (match to the portal's category list before submitting):
- Integration
- Developer tools

## 6. Screenshots to capture

PNG, shown as 600×900 thumbnails. Capture during live QA.

1. Authoring Webhooks tab with several webhooks (enabled/disabled, a "Has rule" badge).
2. Create/edit Authoring webhook dialog with grouped event types and the authorization selector.
3. Experience Edge Webhooks tab with health indicators, including a failing or auto-disabled webhook.
4. Edge webhook details with the execution log.
5. Manual test call result (request, status, latency, response).
6. Edge settings dialog with credentials saved (secret not shown).

## 7. Links

- Website: https://github.com/robertobarbedo/sitecoreai-marketplace-webhooks
- Support: https://github.com/robertobarbedo/sitecoreai-marketplace-webhooks/issues
- Privacy policy: https://github.com/robertobarbedo/sitecoreai-marketplace-webhooks/blob/main/PRIVACY.md
- Terms of service: https://github.com/robertobarbedo/sitecoreai-marketplace-webhooks/blob/main/TERMS.md

## 8. Data usage disclosure

Paste from `DATA-USAGE.md`.

Summary: Authoring webhook data stays between the browser and the customer's SitecoreAI environment through the Marketplace SDK, with the user's own permissions. For the Edge tab, the Edge Client ID and a server-sealed Client Secret are stored in a settings item in the customer's content tree; requests go through the app's own signed-in API routes to `auth.sitecorecloud.io` and `edge.sitecorecloud.io`, and test calls go to the webhook's own endpoint. Nothing is persisted server-side; audit logs (no tokens, secrets, URL paths, headers or bodies) are kept for 90 days.

## 9. AI usage disclosure switch

Off. The app does not use AI or machine learning.

## 10. Configuration tab

- Extension point: **Full Screen**, route `/`.
- API access: **SitecoreAI APIs** (the app calls `xmc.authoring.graphql` through the Marketplace SDK, plus `application.context`; the Edge Admin API is called server-side with the customer's Edge administration client).
- Permissions: none required by the code (no `window.open`, clipboard or file downloads). Note: the credentials help text links to SitecoreAI Deploy with `target="_blank"`; if that link doesn't open in the portal iframe during QA, enable **Pop-ups**.
- Deployment URL: `{{APP_URL}}`
- Client credentials (custom authorization): **Yes**, required for the Experience Edge tab (every `/api/*` route). The Authoring tab works without it. Create Single-page app credentials and register:
  - Allowed callback URL: `{{APP_URL}}/` (with trailing slash)
  - Logout URL, web origin, CORS origin: `{{APP_URL}}`
- Environment variables on the host:
  - `NEXT_PUBLIC_AUTH0_CLIENT_ID` (required)
  - `NEXT_PUBLIC_SITECORE_APP_ID` (required)
  - `EDGE_SECRET_ENCRYPTION_KEY` (required for the Edge tab; server-only, 16+ characters; use the same value as Experience Edge Console to share its stored credentials)
  - Optional: `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_AUDIENCE`, `NEXT_PUBLIC_AUTH0_SCOPE`, `AUTH0_ISSUER`, `CSP_FRAME_ANCESTORS`
- App logo: `public/webhooks-logo-duotone.svg`

## 11. Submission details (visible only to Sitecore)

- Contact name: `Roberto Barbedo`
- Contact email: `rb205@proton.me`

**App functionality**

Webhooks is a Next.js 15 full-stack app on the Full Screen extension point with two tabs. The Authoring Webhooks tab runs entirely in the browser: it reads and writes webhook definition items, Authorization items and event types under `/sitecore/system/Webhooks` and `/sitecore/system/Settings/Webhooks` through the Marketplace SDK (`xmc.authoring.graphql`) with built-in Marketplace authorization and the user's own permissions. The Experience Edge Webhooks tab calls the app's own `/api/edge/*` routes (validate, list/create, read/update/delete, test) with a Sitecore Cloud token from custom authorization (Auth0 SPA client credentials); the server unseals the stored Client Secret, obtains a `client_credentials` token from `auth.sitecorecloud.io` (cached in memory only) and calls `https://edge.sitecorecloud.io/api/admin/v1`. The Edge Client ID and sealed secret are stored as JSON at `/sitecore/system/Modules/Marketplace/Webhooks/Settings` (falling back to the Experience Edge Console settings item). There is no database.

**Business value / alignment with Sitecore standards**

The app puts both of SitecoreAI's webhook systems in one place and gives Experience Edge webhooks a UI they otherwise lack, which shortens integration setup and troubleshooting. It uses only supported Marketplace SDK APIs and the documented Sitecore Cloud token endpoint and Edge Admin API; Authoring webhooks are managed as standard items with the user's own permissions, and webhook rules are never modified. The UI follows the Blok design language (Tailwind CSS v4, Radix UI). Security measures: middleware verifying a Sitecore Cloud token on every `/api/*` route (signature, issuer, audience, expiry and `azp` bound to this app's client ID); the Edge Client Secret sealed with AES-256-GCM (HKDF-SHA256 key from `EDGE_SECRET_ENCRYPTION_KEY`, organization ID and Client ID as additional authenticated data), never shown or prefilled, with no plaintext fallback; an SSRF guard on test calls (https on port 443 only, public addresses checked at connect time against DNS rebinding, no redirects, 15 s timeout, capped response); security headers on every response (HSTS, CSP frame-ancestors limited to SitecoreAI, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and no caching of API responses; and JSON audit logging of sign-in decisions and sensitive operations without tokens, secrets, URL paths, headers or bodies. Fonts are bundled at build time; no analytics.

**Licensing note**

Next.js lists sharp (LGPL-3.0 libvips) as an optional dependency for image optimization; this app doesn't use next/image and sets images.unoptimized, so sharp is never loaded. lightningcss (MPL-2.0) is a build-time-only dependency of Tailwind CSS and is not shipped.

## 12. Pre-submit checklist

- [ ] Live QA, Authoring tab: list, create (with a new inline Authorization item), edit, enable/disable, delete; event types load grouped
- [ ] Live QA, Edge tab: save credentials, list, create, edit, delete, execution log, manual test call
- [ ] Live QA: fallback to Experience Edge Console credentials when both deployments share `EDGE_SECRET_ENCRYPTION_KEY`
- [ ] `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_SITECORE_APP_ID` and `EDGE_SECRET_ENCRYPTION_KEY` set on the production host; app rebuilt
- [ ] Production client credentials registered with `{{APP_URL}}` callback, logout, web origin and CORS URLs
- [ ] Screenshots captured (PNG), with no real secrets, authorization values or private endpoints visible
- [ ] `{{APP_URL}}` replaced with the production deployment URL in this form
