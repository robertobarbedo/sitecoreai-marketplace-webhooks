import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { EVENT_TYPES_ROOT_PATH } from "@/src/constants";
import { getChildren } from "./sitecore-graphql";

/** A selectable webhook event type discovered under the Event Types root. */
export interface WebhookEventType {
  id: string;
  name: string;
  /** Folder chain under the Event Types root, e.g. "Item" or "Publish". */
  category: string;
}

/**
 * Walks /sitecore/system/Settings/Webhooks/Event Types recursively. Items
 * with children are category folders; leaves are event types. The list is
 * discovered at runtime on purpose — Sitecore adds event types (and possibly
 * whole categories) over time, and the app must pick them up without a code
 * change. Depth is not assumed: today the shape is folder → event, but the
 * walk recurses to arbitrary depth (capped defensively).
 */
export async function discoverEventTypes(
  client: ClientSDK,
  sitecoreContextId: string,
): Promise<WebhookEventType[]> {
  const results: WebhookEventType[] = [];

  const walk = async (path: string, category: string, depth: number) => {
    if (depth > 4) return; // defensive cap; real shape is 2 levels
    const children = await getChildren(client, sitecoreContextId, path);
    for (const child of children) {
      if (child.hasChildren) {
        await walk(
          child.path,
          category ? `${category} / ${child.name}` : child.name,
          depth + 1,
        );
      } else {
        results.push({
          id: child.itemId,
          name: child.name,
          category: category || "Other",
        });
      }
    }
  };

  await walk(EVENT_TYPES_ROOT_PATH, "", 0);
  return results;
}

/** Groups event types by category for the picker UI. */
export function groupEventTypes(
  types: WebhookEventType[],
): Map<string, WebhookEventType[]> {
  const groups = new Map<string, WebhookEventType[]>();
  for (const type of types) {
    const list = groups.get(type.category) ?? [];
    list.push(type);
    groups.set(type.category, list);
  }
  return groups;
}

/** Ids may appear braced/unbraced and in any case depending on the source. */
export function normalizeItemId(id: string): string {
  return id.replace(/[{}]/g, "").toLowerCase();
}
