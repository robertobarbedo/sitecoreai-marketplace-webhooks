import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import { audited, hostOf } from "@/src/lib/audit";
import type { Webhook, WebhookInput } from "@/src/types/edge";

type RouteContext = { params: Promise<{ id: string }> };

const UPDATE_EVENT = "edge.webhook.update";
const DELETE_EVENT = "edge.webhook.delete";

export async function GET(request: Request, context: RouteContext) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  const { id } = await context.params;

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    const webhook = await readEdgeResponse<Webhook>(response);
    return NextResponse.json(webhook);
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, UPDATE_EVENT, auth.response, { webhookId: id });
  }
  const credentials = auth.credentials;

  let input: WebhookInput;
  try {
    input = (await request.json()) as WebhookInput;
  } catch {
    return audited(
      request,
      UPDATE_EVENT,
      jsonError("validation", 400, { detail: "Invalid JSON body" }),
      { webhookId: id },
    );
  }

  if (!input.uri || !input.uri.startsWith("https://")) {
    return audited(
      request,
      UPDATE_EVENT,
      jsonError("validation", 400, {
        field: "uri",
        detail: "Webhook URI must use HTTPS",
      }),
      { webhookId: id },
    );
  }
  const targetHost = hostOf(input.uri);

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
    const webhook = await readEdgeResponse<Webhook>(response);
    return audited(request, UPDATE_EVENT, NextResponse.json(webhook), {
      webhookId: id,
      targetHost,
    });
  } catch (error) {
    return audited(request, UPDATE_EVENT, edgeErrorResponse(error), {
      webhookId: id,
      targetHost,
    });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, DELETE_EVENT, auth.response, { webhookId: id });
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(
      credentials,
      `/webhooks/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    await readEdgeResponse(response);
    return audited(
      request,
      DELETE_EVENT,
      new NextResponse(null, { status: 204 }),
      { webhookId: id },
    );
  } catch (error) {
    return audited(request, DELETE_EVENT, edgeErrorResponse(error), {
      webhookId: id,
    });
  }
}
