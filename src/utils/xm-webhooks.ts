import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  SITECORE_TEMPLATES,
  XM_WEBHOOK_PARENT_PATH,
  AUTHORIZATIONS_PARENT_PATH,
} from "@/src/constants";
import {
  queryItemByPath,
  createItem,
  updateItemFields,
  deleteItem,
  getChildrenWithFields,
  type ChildItemWithFields,
  type SitecoreItem,
} from "./sitecore-graphql";
import type {
  XmWebhook,
  XmWebhookInput,
  XmAuthorization,
} from "@/src/types/xm";

function fieldValue(item: ChildItemWithFields | SitecoreItem, name: string): string {
  return (
    item.fields?.nodes?.find(
      (f) => f.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? ""
  );
}

/**
 * Lists the webhook definition items under /sitecore/system/Webhooks. The
 * folder can hold other items, so only children that carry the webhook
 * template's URL field are treated as webhooks.
 */
export async function listXmWebhooks(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<XmWebhook[]> {
  const children = await getChildrenWithFields(
    client,
    sitecoreContextId,
    XM_WEBHOOK_PARENT_PATH,
  );

  return children
    .filter((child) =>
      child.fields?.nodes?.some((f) => f.name.toLowerCase() === "url"),
    )
    .map((child) => ({
      itemId: child.itemId,
      name: child.name,
      path: child.path,
      url: fieldValue(child, "URL"),
      description: fieldValue(child, "Description"),
      enabled: fieldValue(child, "Enabled") === "1",
      eventIds: fieldValue(child, "Events")
        .split("|")
        .map((id) => id.trim())
        .filter(Boolean),
      authorizationId: fieldValue(child, "Authorization"),
      hasRule: fieldValue(child, "Rule").trim() !== "",
    }));
}

/** Authorization items available for linking from a webhook. */
export async function listXmAuthorizations(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<XmAuthorization[]> {
  const children = await getChildrenWithFields(
    client,
    sitecoreContextId,
    AUTHORIZATIONS_PARENT_PATH,
  );
  return children.map((child) => ({
    itemId: child.itemId,
    name: child.name,
    key: fieldValue(child, "Key"),
    addTo: fieldValue(child, "Add to"),
  }));
}

/**
 * Resolves the input's authorization choice to the field value to store:
 * "" for none, the selected item's id, or the id of a freshly created
 * Authorization item (Key/Value/"Add to": Header — the confirmed field
 * convention from the Webhook Relay sibling app).
 */
async function resolveAuthorizationId(
  client: ClientSDK,
  sitecoreContextId: string,
  input: XmWebhookInput,
): Promise<string> {
  if (input.authorizationMode === "existing") {
    return input.existingAuthorizationId ?? "";
  }
  if (input.authorizationMode !== "new") {
    return "";
  }

  const authParent = await queryItemByPath(
    client,
    sitecoreContextId,
    AUTHORIZATIONS_PARENT_PATH,
  );
  if (!authParent) {
    throw new Error(
      `Authorizations parent item not found at ${AUTHORIZATIONS_PARENT_PATH}`,
    );
  }
  const created = await createItem(
    client,
    sitecoreContextId,
    authParent.itemId,
    SITECORE_TEMPLATES.WEBHOOK_AUTHORIZATION,
    sanitizeItemName(`${input.name} Authorization`),
    undefined,
    [
      { name: "Key", value: input.newAuthorizationKey ?? "" },
      { name: "Value", value: input.newAuthorizationValue ?? "" },
      { name: "Add to", value: "Header" },
    ],
  );
  if (!created) {
    throw new Error("Sitecore did not return the created Authorization item");
  }
  return created.itemId;
}

export async function createXmWebhook(
  client: ClientSDK,
  sitecoreContextId: string,
  input: XmWebhookInput,
): Promise<SitecoreItem> {
  const parent = await queryItemByPath(
    client,
    sitecoreContextId,
    XM_WEBHOOK_PARENT_PATH,
  );
  if (!parent) {
    throw new Error(
      `Webhook parent item not found at ${XM_WEBHOOK_PARENT_PATH}. Is this an XM Cloud environment?`,
    );
  }

  const authorizationId = await resolveAuthorizationId(
    client,
    sitecoreContextId,
    input,
  );

  const webhookItem = await createItem(
    client,
    sitecoreContextId,
    parent.itemId,
    SITECORE_TEMPLATES.WEBHOOK,
    sanitizeItemName(input.name),
    undefined,
    [
      { name: "URL", value: input.url },
      { name: "Events", value: input.eventIds.join("|") },
      { name: "Enabled", value: input.enabled ? "1" : "" },
      { name: "Description", value: input.description },
      ...(authorizationId
        ? [{ name: "Authorization", value: authorizationId }]
        : []),
    ],
  );
  if (!webhookItem) {
    // Don't leave an orphaned Authorization item behind.
    if (authorizationId && input.authorizationMode === "new") {
      await deleteItem(client, sitecoreContextId, authorizationId).catch(
        () => undefined,
      );
    }
    throw new Error("Sitecore did not return the created webhook item");
  }
  return webhookItem;
}

export async function updateXmWebhook(
  client: ClientSDK,
  sitecoreContextId: string,
  webhook: XmWebhook,
  input: XmWebhookInput,
): Promise<void> {
  const authorizationId = await resolveAuthorizationId(
    client,
    sitecoreContextId,
    input,
  );

  const updated = await updateItemFields(
    client,
    sitecoreContextId,
    webhook.itemId,
    webhook.path,
    [
      { name: "URL", value: input.url },
      { name: "Events", value: input.eventIds.join("|") },
      { name: "Enabled", value: input.enabled ? "1" : "" },
      { name: "Description", value: input.description },
      { name: "Authorization", value: authorizationId },
    ],
  );
  if (!updated) {
    throw new Error("Sitecore did not return the updated webhook item");
  }
}

export async function setXmWebhookEnabled(
  client: ClientSDK,
  sitecoreContextId: string,
  webhook: XmWebhook,
  enabled: boolean,
): Promise<void> {
  const updated = await updateItemFields(
    client,
    sitecoreContextId,
    webhook.itemId,
    webhook.path,
    [{ name: "Enabled", value: enabled ? "1" : "" }],
  );
  if (!updated) {
    throw new Error("Could not update the webhook item's Enabled field");
  }
}

/**
 * Deletes the webhook definition item only. Linked Authorization items are
 * deliberately left in place — they can be shared between webhooks, and the
 * app cannot tell whether other consumers rely on them.
 */
export async function deleteXmWebhook(
  client: ClientSDK,
  sitecoreContextId: string,
  webhook: XmWebhook,
): Promise<boolean> {
  return deleteItem(client, sitecoreContextId, webhook.itemId);
}

/** Item names cannot contain most punctuation; keep letters/digits/space/-. */
export function sanitizeItemName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} \-]/gu, "").trim();
  return cleaned || "Webhook";
}
