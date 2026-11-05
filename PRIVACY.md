# Privacy Policy

**Last updated: 2026-10-31**

## Overview

This policy explains what data the Webhooks app ("the app") handles, where
it goes, what is stored, and how you can exercise your rights. It applies to
the hosted app listed in the Sitecore Marketplace.

## Summary

- The app has no database. Everything it saves is written to your own
  SitecoreAI environment: webhook items, Authorization items and one
  settings item holding the Experience Edge credentials (the secret only in
  encrypted form).
- The app uses no analytics, tracking or advertising services.
- The only data kept on the app's servers are short audit and runtime log
  lines (who called the API, what operation, the outcome, and for test calls
  the target host name and HTTP status), retained for 90 days, plus
  short-lived Experience Edge access tokens cached in server memory.
- Data leaves your browser only in the ways listed under
  [Where data goes](#where-data-goes).

## How the app works

The app runs inside SitecoreAI and has two tabs:

- **Authoring Webhooks** runs entirely in your browser. It reads and writes
  webhook definition items under `/sitecore/system/Webhooks`, Authorization
  items under `/sitecore/system/Settings/Webhooks/Authorizations` and the
  event types under `/sitecore/system/Settings/Webhooks/Event Types` through
  the Sitecore Marketplace SDK (Authoring and Management GraphQL API), with
  your own SitecoreAI permissions. This data does not reach the app's
  servers.
- **Experience Edge Webhooks** calls the app's own `/api/edge/*` routes. The
  server exchanges your Experience Edge administration credentials for an
  access token at Sitecore Cloud and calls the Experience Edge Admin API to
  list, create, update, delete and test webhooks.

## What data the app handles

- **Authoring webhook data**: webhook names, URLs, descriptions, selected
  events, enabled state, and Authorization items (header key and value,
  which is usually a secret). Read from and written to your environment in
  your browser only.
- **Experience Edge credentials**: the Edge administration Client ID and
  Client Secret you enter in the settings dialog.
- **Experience Edge webhook data**: label, URI, method, execution mode,
  headers, body and execution log of each Edge webhook.
- **Test call data**: the request the app's server sends to a webhook's
  endpoint (configured method, headers and body, or a labelled test
  payload) and the endpoint's response (status, latency, the first 4,000
  characters of the body).
- **Account identifiers**: your Sitecore Cloud user ID (the token's `sub`)
  and organization ID, taken from the access token when you use the
  Experience Edge tab.
- **Sign-in tokens**: your Sitecore Cloud access and refresh tokens, kept in
  your browser.

## Where data goes

1. **Sitecore.** Authoring GraphQL requests, made through the Marketplace
   SDK, and sign-in requests to Sitecore Cloud (see [Sign-in](#sign-in)).
2. **The app's own server (Experience Edge tab).** The browser sends your
   Sitecore Cloud access token, the Edge Client ID and the encrypted Client
   Secret (in request headers) and webhook data (in request bodies) to the
   app's `/api/edge/*` routes. The server decrypts the secret in memory,
   obtains an access token from `auth.sitecorecloud.io` and calls the
   Experience Edge Admin API at `edge.sitecorecloud.io`. The only time a
   plaintext secret reaches the server is when you validate credentials in
   the settings dialog; the server then returns the encrypted form, which is
   what gets stored.
3. **Your webhook endpoint (test calls).** When you test an Edge webhook,
   the app's server sends one request to the URI configured on that
   webhook, with its configured method, headers and body. The endpoint sees
   the request coming from the app's server. The response is returned to
   your browser and not stored.

The app does not sell or share data with anyone else.

## What is stored and where

| Data | Where | Retention |
| --- | --- | --- |
| Authoring webhook items and Authorization items | Your SitecoreAI environment (`/sitecore/system/Webhooks`, `/sitecore/system/Settings/Webhooks/Authorizations`) | Until you delete them |
| Edge Client ID, encrypted Client Secret and last-updated time | Your SitecoreAI environment, item `/sitecore/system/Modules/Marketplace/Webhooks/Settings` (`Value` field) | Until you delete the item |
| Experience Edge access tokens | The app's server memory, per server instance; never written to disk or sent to the browser | Until the token expires or the instance restarts |
| Audit log lines: time (UTC), API path, event (`auth`, `edge.secret.seal`, `edge.webhook.create`, `edge.webhook.update`, `edge.webhook.delete`, `edge.webhook.test`), outcome, HTTP status, Sitecore user ID, organization ID, Edge webhook ID, denial reason, and for webhook changes and test calls the target host name and the endpoint's HTTP status | The publisher's server logs (Vercel runtime logs and the publisher's log store) | 90 days |
| Standard request metadata recorded by the hosting provider (IP address, time, path, user agent) | Vercel | 90 days at most |
| Sign-in tokens and current organization ID | Your browser's `localStorage` | Until you sign out, the session expires, or you clear site data |

Experience Edge webhooks themselves are stored by Sitecore in Experience
Edge, not by the app. Log lines never contain tokens, secrets, webhook URL
paths or queries, headers, bodies or content.

## Who can access it

- **Items in your environment:** anyone with the matching SitecoreAI
  permissions, under your agreement with Sitecore. The stored Client Secret
  can only be decrypted by this app's server, for a signed-in user of the
  same Sitecore Cloud organization.
- **Server logs:** only the app's maintainer, for operating, securing and
  troubleshooting the app, and the hosting provider as a sub-processor.
- **Browser storage:** only you, on your own device.

## How data is protected

- All traffic uses HTTPS (TLS 1.2 or later) with HSTS.
- Every API route verifies your Sitecore Cloud access token (signature,
  issuer, audience, expiry and that it was issued to this app) before acting.
- The Edge Client Secret is encrypted with AES-256-GCM, bound to your
  organization and the Client ID, before it is stored. The plaintext is
  never stored, logged or sent back to the browser.
- Test calls only reach public `https` endpoints on port 443; private and
  internal networks are blocked, redirects are not followed, and the
  timeout is 15 seconds.
- Upstream error details are logged on the server only; the browser gets a
  fixed message.
- Security headers restrict which sites may embed the app.
- Logs are stored with the hosting provider's encryption at rest.

## Sign-in

The Experience Edge tab requires you to sign in with your Sitecore Cloud
account (Sitecore's Auth0 tenant at `auth.sitecorecloud.io`). The sign-in is
handled by Sitecore. The app only receives the resulting access and refresh
tokens; the browser sends the refresh token back to Sitecore's sign-in
service to renew your session. The Authoring tab does not need this
sign-in.

## Local storage

The app uses your browser's local storage only for the sign-in tokens
(access and refresh tokens) and the current organization ID, so you stay
signed in. The organization ID is kept so that switching organization forces
a new sign-in.

This data stays on your device. The access token is sent only to the app's
own server, and the refresh token only to Sitecore's sign-in service. You can
clear all of it by clearing your browser data for the app.

## Sub-processors and third parties

- **Vercel Inc.** (hosting). Serverless functions run in the United States
  (region `iad1`, Washington, D.C.) unless a deployment sets another region.
  See https://vercel.com/legal/privacy-policy.
- **Sitecore** (sign-in, the SitecoreAI APIs, Sitecore Cloud tokens and the
  Experience Edge Admin API), under your own agreement with Sitecore.
- **Your webhook endpoints**, which receive the test calls you start from
  the app's server.

No analytics, tracking or advertising services are used.

## Your rights

Depending on where you live (for example under the GDPR or CCPA), you may
have the right to access, correct, delete, restrict or object to the
processing of your personal data, and to receive a copy of it.

To make a request, email roberto.barbedo@msqdx.com with the subject "Data request".
Include your Sitecore Cloud organization ID and, if you know it, your user
ID, so we can find the matching log lines. We answer within 30 days. The
only personal data the publisher holds is in the server logs described
above. Data in your SitecoreAI environment is controlled by you and your
agreement with Sitecore. You can also complain to your local data protection
authority.

## Deletion

- **Server logs** are deleted automatically after 90 days. On a verified
  request we delete matching log lines sooner where the log store allows it.
- **Cached Edge tokens** disappear when they expire or the server instance
  restarts.
- **Browser data** is deleted when you sign out or clear site data for the
  app.
- **Stored credentials**: delete the item
  `/sitecore/system/Modules/Marketplace/Webhooks/Settings` (or the module
  folder `/sitecore/system/Modules/Marketplace/Webhooks`). If you also used
  the Experience Edge Admin Console app, its item
  `/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings`,
  which this app reads as a fallback, is deleted separately.
- **Webhooks** are deleted from the app or in Sitecore. Uninstalling the app
  does not remove the items or Edge webhooks you created.

## Changes to this policy

We may update this policy from time to time. Changes are published in this
file and reflected in the "Last updated" date at the top.

## Contact

Questions about this policy: email roberto.barbedo@msqdx.com or open an issue at
https://github.com/robertobarbedo/sitecoreai-marketplace-webhooks/issues.
