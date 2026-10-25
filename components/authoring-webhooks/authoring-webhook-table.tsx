"use client";

import {
  mdiPencil,
  mdiDelete,
  mdiLoading,
  mdiPause,
  mdiPlay,
  mdiShieldKeyOutline,
} from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import {
  normalizeItemId,
  type WebhookEventType,
} from "@/src/utils/webhook-events";
import type { XmAuthorization, XmWebhook } from "@/src/types/xm";

interface AuthoringWebhookTableProps {
  webhooks: XmWebhook[];
  /** Discovered event types, for rendering event names; null while loading. */
  eventTypes: WebhookEventType[] | null;
  authorizations: XmAuthorization[];
  onToggleEnabled: (webhook: XmWebhook) => void;
  onEdit: (webhook: XmWebhook) => void;
  onDelete: (webhook: XmWebhook) => void;
  /** Item id of the webhook whose enable/disable call is in flight, if any. */
  togglingId?: string | null;
}

function EventsCell({
  webhook,
  eventTypes,
}: {
  webhook: XmWebhook;
  eventTypes: WebhookEventType[] | null;
}) {
  if (webhook.eventIds.length === 0) {
    return <span className="text-text-subtle">None</span>;
  }

  const byId = new Map(
    (eventTypes ?? []).map((t) => [normalizeItemId(t.id), t.name]),
  );
  const names = webhook.eventIds.map(
    (id) => byId.get(normalizeItemId(id)) ?? "Unknown event",
  );
  const shown = names.slice(0, 2).join(", ");
  const extra = names.length - 2;

  return (
    <span title={names.join(", ")}>
      {shown}
      {extra > 0 && (
        <span className="text-text-subtle"> +{extra} more</span>
      )}
    </span>
  );
}

export function AuthoringWebhookTable({
  webhooks,
  eventTypes,
  authorizations,
  onToggleEnabled,
  onEdit,
  onDelete,
  togglingId,
}: AuthoringWebhookTableProps) {
  const authById = new Map(
    authorizations.map((a) => [normalizeItemId(a.itemId), a]),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border-muted bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-muted bg-surface-grey">
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Name
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                URL
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Events
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Authorization
              </th>
              <th className="px-4 py-4 font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Status
              </th>
              <th className="px-4 py-4 text-right font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((webhook) => {
              const auth = webhook.authorizationId
                ? authById.get(normalizeItemId(webhook.authorizationId))
                : undefined;
              return (
                <tr
                  key={webhook.itemId}
                  className="border-b border-border-muted last:border-b-0 hover:bg-surface-container-low/60"
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span>{webhook.name}</span>
                      {webhook.description && (
                        <span
                          className="max-w-[240px] truncate text-xs text-text-subtle"
                          title={webhook.description}
                        >
                          {webhook.description}
                        </span>
                      )}
                      {webhook.hasRule && (
                        <span
                          className="inline-flex w-fit items-center rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-fg"
                          title="This webhook has a rule filter. Rules are out of this app's scope — edit them in the Content Editor."
                        >
                          Has rule
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className="max-w-[320px] truncate px-4 py-3 font-mono text-xs"
                    title={webhook.url}
                  >
                    {webhook.url || "—"}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3">
                    <EventsCell webhook={webhook} eventTypes={eventTypes} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {webhook.authorizationId ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary-bg px-2 py-0.5 text-xs font-semibold text-primary-fg"
                        title={
                          auth
                            ? `${auth.name}${auth.key ? ` — header ${auth.key}` : ""}`
                            : "Linked Authorization item not found under the Authorizations folder"
                        }
                      >
                        <Icon path={mdiShieldKeyOutline} size={0.6} />
                        {auth?.name ?? "Unknown"}
                      </span>
                    ) : (
                      <span className="text-text-subtle">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {webhook.enabled ? (
                      <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success-fg">
                        Enabled
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onToggleEnabled(webhook)}
                        disabled={togglingId !== null && togglingId !== undefined}
                        title={
                          webhook.enabled
                            ? "Disable this webhook"
                            : "Enable this webhook"
                        }
                        aria-label={`${webhook.enabled ? "Disable" : "Enable"} ${webhook.name}`}
                      >
                        <Icon
                          path={
                            togglingId === webhook.itemId
                              ? mdiLoading
                              : webhook.enabled
                                ? mdiPause
                                : mdiPlay
                          }
                          className={
                            togglingId === webhook.itemId ? "animate-spin" : ""
                          }
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(webhook)}
                        aria-label={`Edit ${webhook.name}`}
                      >
                        <Icon path={mdiPencil} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        colorScheme="danger"
                        onClick={() => onDelete(webhook)}
                        aria-label={`Delete ${webhook.name}`}
                      >
                        <Icon path={mdiDelete} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
