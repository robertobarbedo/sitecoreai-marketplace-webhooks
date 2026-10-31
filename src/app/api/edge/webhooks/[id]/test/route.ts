import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import {
  BlockedUrlError,
  parsePublicHttpsUrl,
  publicHttpsRequest,
} from "@/src/lib/edge/public-https";
import { describeRequestError } from "@/src/utils/ssrfGuard";
import { auditOperation, audited, hostOf } from "@/src/lib/audit";
import type { Webhook, WebhookTestResult } from "@/src/types/edge";

/**
 * Fires a test call at a configured webhook's endpoint, the way Experience
 * Edge would: same URI, method, headers and body. The target is read from the
 * Admin API by id rather than taken from the request — the browser can only
 * name a webhook that already exists. Because anyone with the credentials
 * can create a webhook with any URI, the call itself is SSRF-guarded too
 * (src/lib/edge/public-https.ts): https:443 to public addresses only, checked
 * at connect time, no redirects followed.
 */

type RouteContext = { params: Promise<{ id: string }> };

const TEST_TIMEOUT_MS = 15_000;
const RESPONSE_BODY_LIMIT = 4_000;
const TEST_EVENT = "edge.webhook.test";

/** Sent when the webhook has no body configured, so the call carries something recognizable. */
function defaultTestBody(webhook: Webhook): string {
  return JSON.stringify(
    {
      test: true,
      source: "Experience Edge Admin Console",
      webhookId: webhook.id,
      webhookLabel: webhook.label,
      message:
        "Test call from the Experience Edge Admin Console — not a real publish notification.",
      sentAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, TEST_EVENT, auth.response, { webhookId: id });
  }
  const credentials = auth.credentials;

  let webhook: Webhook | null;
  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    webhook = await readEdgeResponse<Webhook>(response);
  } catch (error) {
    return audited(request, TEST_EVENT, edgeErrorResponse(error), {
      webhookId: id,
    });
  }

  if (!webhook?.uri) {
    return audited(
      request,
      TEST_EVENT,
      jsonError("validation", 404, {
        detail: "Webhook not found, or it has no URI configured",
      }),
      { webhookId: id },
    );
  }
  // Only the host goes to the audit log, never the URI path or query.
  const targetHost = hostOf(webhook.uri);
  try {
    parsePublicHttpsUrl(webhook.uri);
  } catch (error) {
    auditOperation(request, TEST_EVENT, "deny", {
      webhookId: id,
      targetHost,
      reason: "blocked_url",
    });
    return jsonError("validation", 400, {
      field: "uri",
      detail: `This webhook can't be tested from here: ${
        error instanceof Error ? error.message : "URL is not allowed"
      }`,
    });
  }

  // GET/DELETE carry no body; anything else sends the configured body, or a
  // labelled test payload when none is set.
  const sendsBody = webhook.method !== "GET" && webhook.method !== "DELETE";
  const body = sendsBody ? (webhook.body || defaultTestBody(webhook)) : undefined;

  const startedAt = Date.now();
  try {
    const response = await publicHttpsRequest(webhook.uri, {
      method: webhook.method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(webhook.headers ?? {}),
      },
      body,
      timeoutMs: TEST_TIMEOUT_MS,
      maxResponseChars: RESPONSE_BODY_LIMIT,
    });

    auditOperation(request, TEST_EVENT, "allow", {
      webhookId: id,
      targetHost,
      upstreamStatus: response.status,
    });
    return NextResponse.json({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startedAt,
      requestMethod: webhook.method,
      requestUri: webhook.uri,
      requestBody: body,
      responseBody: response.body,
      responseTruncated: response.truncated,
    } satisfies WebhookTestResult);
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      auditOperation(request, TEST_EVENT, "deny", {
        webhookId: id,
        targetHost,
        reason: "blocked_url",
      });
      return jsonError("validation", 400, {
        field: "uri",
        detail: `This webhook can't be tested from here: ${error.message}`,
      });
    }
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    auditOperation(request, TEST_EVENT, "error", {
      webhookId: id,
      targetHost,
      reason: timedOut ? "timeout" : "request_failed",
    });
    // A refused connection, DNS failure or timeout is a legitimate test
    // outcome, not an app error — report it as a result the user can read.
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - startedAt,
      requestMethod: webhook.method,
      requestUri: webhook.uri,
      requestBody: body,
      errorMessage: timedOut
        ? `No response within ${TEST_TIMEOUT_MS / 1000} seconds`
        : describeRequestError(error),
    } satisfies WebhookTestResult);
  }
}
