import { NextResponse } from "next/server";
import { edgeFetch, readEdgeResponse } from "@/src/lib/edge/admin-client";
import {
  readCredentials,
  edgeErrorResponse,
  jsonError,
} from "@/src/lib/edge/request";
import { audited, hostOf } from "@/src/lib/audit";
import type { Webhook, WebhookInput } from "@/src/types/edge";

const CREATE_EVENT = "edge.webhook.create";

export async function GET(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return auth.response;
  }
  const credentials = auth.credentials;

  try {
    const response = await edgeFetch(credentials, "/webhooks", {
      method: "GET",
    });
    const webhooks = await readEdgeResponse<Webhook[]>(response);
    return NextResponse.json(webhooks ?? []);
  } catch (error) {
    return edgeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await readCredentials(request);
  if (!auth.ok) {
    return audited(request, CREATE_EVENT, auth.response);
  }
  const credentials = auth.credentials;

  let input: WebhookInput;
  try {
    input = (await request.json()) as WebhookInput;
  } catch {
    return audited(
      request,
      CREATE_EVENT,
      jsonError("validation", 400, { detail: "Invalid JSON body" }),
    );
  }

  if (!input.uri || !input.uri.startsWith("https://")) {
    return audited(
      request,
      CREATE_EVENT,
      jsonError("validation", 400, {
        field: "uri",
        detail: "Webhook URI must use HTTPS",
      }),
    );
  }
  const targetHost = hostOf(input.uri);

  try {
    const response = await edgeFetch(credentials, "/webhooks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const webhook = await readEdgeResponse<Webhook>(response);
    return audited(
      request,
      CREATE_EVENT,
      NextResponse.json(webhook, { status: 201 }),
      { webhookId: webhook?.id, targetHost },
    );
  } catch (error) {
    return audited(request, CREATE_EVENT, edgeErrorResponse(error), {
      targetHost,
    });
  }
}
