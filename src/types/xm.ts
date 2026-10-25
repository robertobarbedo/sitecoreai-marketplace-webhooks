/**
 * Types for the SitecoreAI Authoring (XM Cloud) webhook definition items
 * managed through the Marketplace SDK's authoring GraphQL.
 */

/** A webhook definition item under /sitecore/system/Webhooks. */
export interface XmWebhook {
  itemId: string;
  name: string;
  path: string;
  url: string;
  description: string;
  enabled: boolean;
  /** Raw ids from the pipe-separated Events field. */
  eventIds: string[];
  /** Raw id value of the linked Authorization item, "" when none. */
  authorizationId: string;
  /**
   * The Rule field is out of the app's scope (users edit it in Sitecore);
   * surfaced only so the UI can flag that a rule exists.
   */
  hasRule: boolean;
}

/** An Authorization item under /sitecore/system/Settings/Webhooks/Authorizations. */
export interface XmAuthorization {
  itemId: string;
  name: string;
  /** Header name the value is sent under. */
  key: string;
  /** "Header" (the only mode this app creates). */
  addTo: string;
}

export type XmAuthorizationMode = "none" | "existing" | "new";

/** What the create/edit form submits. */
export interface XmWebhookInput {
  /** Item name; fixed after creation (the app never renames items). */
  name: string;
  url: string;
  description: string;
  enabled: boolean;
  eventIds: string[];
  authorizationMode: XmAuthorizationMode;
  /** Item id of the selected Authorization (mode "existing"). */
  existingAuthorizationId?: string;
  /** Header name/value for a new Authorization item (mode "new"). */
  newAuthorizationKey?: string;
  newAuthorizationValue?: string;
}
