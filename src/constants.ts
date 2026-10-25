/**
 * Webhooks app constants
 */

/**
 * Sitecore database names
 */
export const SITECORE_DATABASES = {
  MASTER: "master",
} as const;

/**
 * Default language used for settings items
 */
export const DEFAULT_LANGUAGE = "en";

/**
 * Language type definition
 */
export type Language = string;

/**
 * Template and parent IDs (shared with the other marketplace modules)
 */
export const SITECORE_TEMPLATES = {
  MODULE_FOLDER: "{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}",
  SETTINGS_ITEM: "{D2923FEE-DA4E-49BE-830C-E27764DFA269}",
  /** XM Cloud webhook definition items (confirmed on a live instance). */
  WEBHOOK: "{F05212CE-30A7-4733-A7F4-ED6E13F26692}",
  /** Webhook Authorization items: Key / Value / "Add to" (confirmed). */
  WEBHOOK_AUTHORIZATION: "{950542DA-E851-4996-A20A-89B40309F130}",
} as const;

export const MODULES_PARENT_ID = "{08477468-D438-43D4-9D6A-6D84A611971C}";

/**
 * Content tree paths where this app persists its settings (the Experience
 * Edge admin credentials)
 */
export const SETTINGS_PATHS = {
  MARKETPLACE_FOLDER: "/sitecore/system/Modules/Marketplace",
  MODULE_FOLDER: "/sitecore/system/Modules/Marketplace/Webhooks",
  SETTINGS_ITEM: "/sitecore/system/Modules/Marketplace/Webhooks/Settings",
} as const;

/**
 * The sibling Experience Edge Admin Console stores the same credential payload
 * under its own module folder. Reading it as a fallback means a tenant that
 * already configured that app is connected here out of the box; saves always
 * write this app's own path.
 */
export const LEGACY_SETTINGS_ITEM_PATH =
  "/sitecore/system/Modules/Marketplace/ExperienceEdgeAdminConsole/Settings";

export const MARKETPLACE_FOLDER_NAME = "Marketplace";
export const MODULE_FOLDER_NAME = "Webhooks";
export const SETTINGS_ITEM_NAME = "Settings";

/**
 * Where XM Cloud webhook definition items live. The parent item's id is
 * resolved by path at creation time.
 */
export const XM_WEBHOOK_PARENT_PATH = "/sitecore/system/Webhooks";

/** Where webhook Authorization items live. */
export const AUTHORIZATIONS_PARENT_PATH =
  "/sitecore/system/Settings/Webhooks/Authorizations";

/**
 * Root of the selectable webhook event types. Walked recursively at runtime —
 * folders are categories, leaves are event types. Never hardcode the event
 * list; Sitecore adds types over time.
 */
export const EVENT_TYPES_ROOT_PATH =
  "/sitecore/system/Settings/Webhooks/Event Types";
