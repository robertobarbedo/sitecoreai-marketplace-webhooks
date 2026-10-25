import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  SITECORE_DATABASES,
  DEFAULT_LANGUAGE,
  type Language,
} from "@/src/constants";

export interface FieldNode {
  name: string;
  value: string;
}

export interface SitecoreItem {
  itemId: string;
  name: string;
  path: string;
  fields?: { nodes: FieldNode[] };
}

export interface ChildNode {
  itemId: string;
  name: string;
  path: string;
  hasChildren: boolean;
}

/** A child item including its own field values (one query, no N+1 reads). */
export interface ChildItemWithFields extends ChildNode {
  fields?: { nodes: FieldNode[] };
}

export function escapeGraphQL(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function getSitecoreContextId(
  client: ClientSDK,
): Promise<string> {
  const contextResponse = await client.query("application.context");
  const appContext = contextResponse.data as Record<string, unknown>;
  const resourceAccess = appContext?.resourceAccess as
    | Array<{ context?: { preview?: string } }>
    | undefined;
  return resourceAccess?.[0]?.context?.preview ?? "";
}

/**
 * Runs an authoring GraphQL document against the environment identified by
 * `sitecoreContextId`. Throws when the response carries GraphQL errors.
 */
async function runAuthoring<T>(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
): Promise<T> {
  const response = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query },
    },
  });

  const payload = (
    response as Record<string, unknown> & {
      data?: { data?: T; errors?: { message?: string }[] };
    }
  ).data;

  if (payload?.errors?.length) {
    throw new Error(
      payload.errors
        .map((e) => e.message ?? "Unknown GraphQL error")
        .join("; "),
    );
  }
  if (payload?.data === undefined || payload?.data === null) {
    throw new Error("Empty GraphQL response");
  }
  return payload.data;
}

export async function queryItemByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const data = await runAuthoring<{ item: SitecoreItem | null }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}" }) {
          itemId
          name
          path
          fields(ownFields: true, excludeStandardFields: true) {
            nodes { name value }
          }
        }
      }
    `,
  );
  return data.item ?? null;
}

/** Children of an item, for walking the Event Types tree. */
export async function getChildren(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<ChildNode[]> {
  const data = await runAuthoring<{
    item: { children?: { nodes?: ChildNode[] } } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}" }) {
          children(first: 100) {
            nodes {
              itemId
              name
              path
              hasChildren
            }
          }
        }
      }
    `,
  );
  return data.item?.children?.nodes ?? [];
}

/**
 * Children of an item WITH their field values — how the webhook and
 * Authorization definition lists are read in a single round trip.
 *
 * `ownFields: false` on purpose: Sitecore's webhook/Authorization templates
 * INHERIT their fields (URL, Events, Key, …) from base templates, and with
 * `ownFields: true` the field list comes back empty — which made the webhook
 * list silently render nothing.
 */
export async function getChildrenWithFields(
  client: ClientSDK,
  sitecoreContextId: string,
  path: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<ChildItemWithFields[]> {
  const data = await runAuthoring<{
    item: { children?: { nodes?: ChildItemWithFields[] } } | null;
  }>(
    client,
    sitecoreContextId,
    `
      query {
        item(where: { database: "${SITECORE_DATABASES.MASTER}", path: "${escapeGraphQL(path)}", language: "${escapeGraphQL(language)}" }) {
          children(first: 100) {
            nodes {
              itemId
              name
              path
              hasChildren
              fields(ownFields: false, excludeStandardFields: true) {
                nodes { name value }
              }
            }
          }
        }
      }
    `,
  );
  return data.item?.children?.nodes ?? [];
}

export async function createItem(
  client: ClientSDK,
  sitecoreContextId: string,
  parentId: string,
  templateId: string,
  itemName: string,
  language: Language = DEFAULT_LANGUAGE,
  fields?: { name: string; value: string }[],
): Promise<SitecoreItem | null> {
  const fieldEntries = (fields ?? [])
    .map(
      (f) =>
        `{ name: "${escapeGraphQL(f.name)}", value: "${escapeGraphQL(f.value)}" }`,
    )
    .join(", ");

  const data = await runAuthoring<{
    createItem: { item: SitecoreItem | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        createItem(input: {
          database: "${SITECORE_DATABASES.MASTER}"
          name: "${escapeGraphQL(itemName)}"
          parent: "${escapeGraphQL(parentId)}"
          templateId: "${escapeGraphQL(templateId)}"
          language: "${escapeGraphQL(language)}"
          ${fields?.length ? `fields: [${fieldEntries}]` : ""}
        }) {
          item {
            itemId
            name
            path
            fields(ownFields: true, excludeStandardFields: true) {
              nodes { name value }
            }
          }
        }
      }
    `,
  );
  return data.createItem?.item ?? null;
}

/**
 * Updates one or more fields. Settings/webhook definition items are
 * unversioned enough that version 1 is always correct (same convention as the
 * sibling apps' settings items).
 */
export async function updateItemFields(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fields: { name: string; value: string }[],
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const fieldEntries = fields
    .map(
      (f) =>
        `{ name: "${escapeGraphQL(f.name)}", value: "${escapeGraphQL(f.value)}", reset: false }`,
    )
    .join(", ");

  const data = await runAuthoring<{
    updateItem: { item: SitecoreItem | null } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        updateItem(input: {
          fields: [${fieldEntries}]
          database: "${SITECORE_DATABASES.MASTER}"
          itemId: "${escapeGraphQL(itemId)}"
          language: "${escapeGraphQL(language)}"
          path: "${escapeGraphQL(itemPath)}"
          version: 1
        }) {
          item {
            itemId
            name
            path
            fields(ownFields: true, excludeStandardFields: true) {
              nodes { name value }
            }
          }
        }
      }
    `,
  );
  return data.updateItem?.item ?? null;
}

export async function updateItemField(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  return updateItemFields(
    client,
    sitecoreContextId,
    itemId,
    itemPath,
    [{ name: fieldName, value: fieldValue }],
    language,
  );
}

export async function updateItemFieldByPath(
  client: ClientSDK,
  sitecoreContextId: string,
  itemPath: string,
  fieldName: string,
  fieldValue: string,
  language: Language = DEFAULT_LANGUAGE,
): Promise<SitecoreItem | null> {
  const item = await queryItemByPath(
    client,
    sitecoreContextId,
    itemPath,
    language,
  );
  if (!item) return null;
  return updateItemField(
    client,
    sitecoreContextId,
    item.itemId,
    itemPath,
    fieldName,
    fieldValue,
    language,
  );
}

export async function deleteItem(
  client: ClientSDK,
  sitecoreContextId: string,
  itemId: string,
): Promise<boolean> {
  const data = await runAuthoring<{
    deleteItem: { successful: boolean } | null;
  }>(
    client,
    sitecoreContextId,
    `
      mutation {
        deleteItem(input: {
          database: "${SITECORE_DATABASES.MASTER}"
          itemId: "${escapeGraphQL(itemId)}"
          permanently: true
        }) {
          successful
        }
      }
    `,
  );
  return data.deleteItem?.successful ?? false;
}
