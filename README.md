# Webhooks

A SitecoreAI Marketplace app for admins and developers who manage both the
Authoring webhooks and the Experience Edge webhooks of an environment.

A SitecoreAI (XM Cloud) environment has two separate webhook systems.
Authoring webhooks are definition items in the content tree, fired by
authoring events such as item saves, publishes and workflow transitions.
Experience Edge webhooks are registered through the Experience Edge Admin API
and fire when content is published to Edge. Each one is managed in a
different place with a different tool, and the Edge webhooks have no UI at
all.

This app brings both into one tabbed screen. You can list, create, edit,
enable/disable, delete and inspect webhooks of either kind without leaving
SitecoreAI.

## Features

- **Authoring webhooks list**: every webhook item under
  `/sitecore/system/Webhooks`, with URL, events, authorization and enabled
  state.
- **Create and edit Authoring webhooks**: name, URL, description, events,
  authorization and enabled flag.
- **Runtime event discovery**: event types come from
  `/sitecore/system/Settings/Webhooks/Event Types` and are grouped by
  category, so new Sitecore event types show up without an app update.
- **Authorization items**: link an existing Authorization item (a secret
  header), or create a new one inline from the webhook form.
- **One-click enable/disable** and delete with confirmation.
- **Rule-aware**: webhooks that have a `Rule` filter get a "Has rule" badge.
  The app never changes rules; edit them in Sitecore itself.
- **Experience Edge webhooks**: list, create, edit and delete, with label,
  URI, method, execution mode (`OnEnd` / `OnUpdate`), headers, body and
  body-include.
- **Execution log and health**: the recent runs Edge keeps on each webhook,
  consecutive-failure counts, and a warning when Edge has disabled a webhook
  automatically after 10 consecutive failures.
- **Manual test calls**: fire a webhook from the server with its configured
  method, headers and body (or a labelled test payload), and see the request,
  status, latency and response.
- **Encrypted Edge credentials**: the Edge client secret is validated, sealed
  on the server and never shown again.

## How it works

- **Extension point**: Full Screen, served from the root route `/`.
- **Authoring Webhooks tab**: runs entirely in the browser. It calls the
  Authoring and Management GraphQL API through the Marketplace SDK
  (`xmc.authoring.graphql`) with the signed-in user's own permissions. Webhook
  items, Authorization items and event types are read and written as regular
  content items. No extra credentials are needed.

  ```
  browser -> Marketplace SDK -> Authoring and Management GraphQL
  ```

- **Experience Edge Webhooks tab**: the browser calls the app's own `/api/edge/*`
  routes. The server exchanges the stored Edge administration credentials for
  an OAuth token at `auth.sitecorecloud.io` (client credentials grant), caches
  the token in memory, and calls the
  [Experience Edge Admin API](https://doc.sitecore.com/sai/en/developers/sitecoreai/experience-edge/experience-edge-apis/admin-rest-api.html)
  at `https://edge.sitecorecloud.io/api/admin/v1`.

  ```
  browser -> /api/edge/* (Sitecore Cloud sign-in + sealed credentials)
          -> auth.sitecorecloud.io (token) -> Edge Admin API
  ```

- **Credentials storage**: the Edge Client ID and the sealed Client Secret are
  stored as JSON in the `Value` field of a settings item in the environment's
  content tree (see [Configuration](#configuration)).

### API routes

Every route requires a signed-in Sitecore user of this app (bearer token) and
the stored Edge credentials in the `x-edge-client-id` and
`x-edge-client-secret` headers. The secret header only ever carries the sealed
form, except on `validate`.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/edge/validate` | Check a credential pair against the Edge Admin API and return the sealed secret to store |
| `GET` | `/api/edge/webhooks` | List Edge webhooks |
| `POST` | `/api/edge/webhooks` | Create an Edge webhook (HTTPS URI required) |
| `GET` | `/api/edge/webhooks/{id}` | Read one webhook, including its execution log |
| `PUT` | `/api/edge/webhooks/{id}` | Update a webhook (HTTPS URI required) |
| `DELETE` | `/api/edge/webhooks/{id}` | Delete a webhook |
| `POST` | `/api/edge/webhooks/{id}/test` | Fire a test call at the webhook's endpoint and return the result |

## Requirements

- A SitecoreAI (XM Cloud) organization and environment.
- Organization Admin or Owner rights in the Cloud Portal to create and
  install the app.
- For the Authoring tab: a SitecoreAI user who can read and write items under
  `/sitecore/system/Webhooks` and
  `/sitecore/system/Settings/Webhooks/Authorizations`.
- For the Experience Edge tab:
  - An Experience Edge administration client (Client ID and Client Secret)
    for the environment.
  - Write access to `/sitecore/system/Modules/Marketplace` so the app can
    store the credentials.
  - Single-page app client credentials for this app (custom authorization,
    see below).

## Install in SitecoreAI

1. In the Cloud Portal, open **App Studio** and choose **Create App**.
2. Enter an app name (for example `Webhooks`) and select type **Custom**.
3. Add the **Full Screen** extension point with route `/`.
4. Under API access, enable **SitecoreAI APIs**.
5. Set the deployment URL to `https://<your-deployment>/`.
6. Upload the app logo from [`public/icon.svg`](public/icon.svg).
7. Set up custom authorization: create client credentials of type
   **Single-page app**, and register your deployment origin
   (`https://<your-deployment>`) as callback URL (with a trailing `/`), logout
   URL, web origin and CORS origin. Put the client ID and the app ID in the
   deployment's environment variables (see below).
8. Install the app in your organization, then open **Webhooks** from the apps
   menu of SitecoreAI.
9. On the **Experience Edge Webhooks** tab, open settings (gear icon) and
   enter the Edge administration Client ID and Client Secret.

## Deploy your own instance

```bash
npm install
npm run build
npm start
```

Deploy to Vercel or any Node.js host, then point the App Studio deployment URL
at it.

| Variable | Required | Description |
| --- | --- | --- |
| `EDGE_SECRET_ENCRYPTION_KEY` | Yes, for the Edge tab | Server-only. Passphrase of at least 16 characters used to seal the Edge Client Secret (AES-256-GCM, key derived with HKDF-SHA256). Generate with `openssl rand -base64 32`. Keep it stable: changing it makes stored secrets unreadable. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Yes | Client ID of the app's Single-page app client credentials. Without it every API route returns 500. |
| `NEXT_PUBLIC_SITECORE_APP_ID` | Yes | Marketplace app ID, sent at sign-in as `product_codes=mkp_<id>`. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 measurement ID. Leave empty to disable analytics. |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | No | Defaults to `auth.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_AUDIENCE` | No | Defaults to `https://api-webapp.sitecorecloud.io`. |
| `NEXT_PUBLIC_AUTH0_SCOPE` | No | Defaults to `openid profile email offline_access`. |
| `AUTH0_ISSUER` | No | Server-only. Defaults to `https://auth.sitecorecloud.io/`. |

See [`.env.example`](.env.example) for a template.

If you also run the **Experience Edge Console** app, give both deployments the
same `EDGE_SECRET_ENCRYPTION_KEY`. Webhooks then reads the credentials already
stored by Experience Edge Console and re-seals them in its own format the
first time it loads.

The app only runs inside SitecoreAI: the Marketplace SDK needs the SitecoreAI
host iframe. Opening the deployment directly in a browser shows a "Failed to
connect to Sitecore" error. For local development, run `npm run dev` (port
5005), expose it over HTTPS (for example with ngrok), and register that URL in
a separate development app in App Studio.

## Configuration

- **Edge credentials** are stored in the content tree of the environment at
  `/sitecore/system/Modules/Marketplace/Webhooks/Settings`, as JSON in the
  `Value` field (Client ID, sealed Client Secret, last-updated time). The app
  creates the folders on first save.
- **Fallback to Experience Edge Console**: if this app's settings item does not
  exist, it reads the Experience Edge Console settings item
  (`/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings`),
  so an environment that already configured that app is connected right away.
  Saves always go to this app's own item. If the two deployments use
  different encryption keys, the stored secret can't be read; the settings
  dialog opens and the credentials you re-enter are saved under this app's
  own item.
- **Changing the Client ID** requires re-entering the Client Secret, because
  each sealed secret is bound to its Client ID.
- The Authoring tab has no settings. It works with the webhook, authorization
  and event type items that SitecoreAI already provides.

## Security and privacy

- **Authentication**: the Authoring tab uses the Marketplace SDK, so every read
  and write runs with the signed-in SitecoreAI user's own permissions. Every
  `/api/*` route requires a Sitecore Cloud sign-in token issued to this app
  (checked in middleware for signature, issuer, audience, expiry and client
  ID). Sign-in doesn't block the Authoring tab.
- **Secrets**: the only stored secret is the Edge Client Secret. The server
  validates it, then seals it with AES-256-GCM using the deployment's
  `EDGE_SECRET_ENCRYPTION_KEY`, with the Client ID as authenticated data. Only
  the ciphertext reaches the content tree and the browser. The settings
  dialog never shows or prefills it. Without the encryption key the app
  refuses to save credentials; it never stores plaintext. Older plaintext or
  unbound values are upgraded automatically on load.
- **Authorization item values** (the secret header of Authoring webhooks) are
  stored by SitecoreAI as regular item fields, as SitecoreAI itself does.
- **Data flow**: Authoring webhook data stays between the browser and your
  SitecoreAI environment. Edge requests go from the browser to this app's own
  server, then to `auth.sitecorecloud.io` and `edge.sitecorecloud.io`. OAuth
  tokens are cached in server memory only and never sent to the browser.
- **Test calls**: a test call goes from this app's server to the endpoint
  configured on the Edge webhook, with the configured headers and body. Only
  `https` URLs on port 443 are allowed, every resolved address must be public
  (checked at connect time, which also blocks DNS rebinding), redirects are
  not followed, the timeout is 15 seconds and the response body read is
  capped.
- **Analytics**: if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, Google Analytics
  receives page views and a `marketplace_client_ready` event, tagged with the
  app name. No content or webhook data is sent.

## Limitations

- Webhook `Rule` filters can't be edited in the app; change them in Sitecore.
- Webhook item names can't be changed after creation.
- Deleting an Authoring webhook leaves its Authorization item in place,
  because Authorization items can be shared between webhooks.
- Authoring webhooks can't be test-fired from the app. Manual test calls are
  only available for Experience Edge webhooks.
- Test calls only reach public `https` endpoints on port 443, so internal or
  local endpoints can't be tested from here.
- The Experience Edge tab manages webhooks only; Edge cache and settings are
  not included.
- Event type discovery walks up to four levels below the Event Types root.

## Development

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Radix UI,
  class-variance-authority, Marketplace SDK (`@sitecore-marketplace-sdk/client`
  and `/xmc`), `@auth0/auth0-react` and `jose` for sign-in.
- `npm run dev` starts the dev server on port 5005. `npm run build` runs the
  type check, lint and production build.
- Project structure:
  - `src/app/`: the page and the `/api/edge/*` routes
  - `src/lib/edge/`: Edge Admin API client, token cache, secret sealing,
    SSRF-safe HTTPS client
  - `src/lib/marketplace-auth/`: Sitecore Cloud sign-in kit (see its
    [README](src/lib/marketplace-auth/README.md))
  - `src/utils/`: Authoring GraphQL helpers, settings storage, hooks
  - `components/`: tab, table and dialog components and UI primitives
  - `public/`: app icon

## Support

Report bugs and request features by opening an issue in this repository.
This is a community app and is not an official Sitecore product.

## License

Licensed under the Apache License 2.0 — see [LICENSE](LICENSE).
