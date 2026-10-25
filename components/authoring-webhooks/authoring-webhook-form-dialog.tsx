"use client";

import { useEffect, useMemo, useState } from "react";
import { mdiLoading } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupEventTypes,
  normalizeItemId,
  type WebhookEventType,
} from "@/src/utils/webhook-events";
import type {
  XmAuthorization,
  XmWebhook,
  XmWebhookInput,
} from "@/src/types/xm";

interface AuthoringWebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Webhook being edited, or null when creating a new one. */
  webhook: XmWebhook | null;
  /** Discovered event types; null while the discovery walk is running. */
  eventTypes: WebhookEventType[] | null;
  authorizations: XmAuthorization[];
  onSubmit: (input: XmWebhookInput) => Promise<void>;
}

/** Sentinel Select values — Radix SelectItem values cannot be empty. */
const AUTH_NONE = "__none__";
const AUTH_NEW = "__new__";

export function AuthoringWebhookFormDialog({
  open,
  onOpenChange,
  webhook,
  eventTypes,
  authorizations,
  onSubmit,
}: AuthoringWebhookFormDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [authChoice, setAuthChoice] = useState<string>(AUTH_NONE);
  const [newAuthKey, setNewAuthKey] = useState("");
  const [newAuthValue, setNewAuthValue] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName(webhook?.name ?? "");
      setUrl(webhook?.url ?? "");
      setDescription(webhook?.description ?? "");
      setEnabled(webhook?.enabled ?? true);
      setSelectedEvents(
        new Set((webhook?.eventIds ?? []).map(normalizeItemId)),
      );
      setAuthChoice(
        webhook?.authorizationId
          ? normalizeItemId(webhook.authorizationId)
          : AUTH_NONE,
      );
      setNewAuthKey("");
      setNewAuthValue("");
      setPending(false);
    }
  }, [open, webhook]);

  const groupedEvents = useMemo(
    () => (eventTypes ? groupEventTypes(eventTypes) : null),
    [eventTypes],
  );

  const knownEventIds = useMemo(
    () => new Set((eventTypes ?? []).map((t) => normalizeItemId(t.id))),
    [eventTypes],
  );

  const urlValid = /^https?:\/\//.test(url);
  const isNewAuth = authChoice === AUTH_NEW;
  const authValid =
    !isNewAuth || (newAuthKey.trim() !== "" && newAuthValue.trim() !== "");
  const canSubmit =
    name.trim() !== "" &&
    urlValid &&
    selectedEvents.size > 0 &&
    authValid &&
    !pending;

  const toggleEvent = (id: string) => {
    const key = normalizeItemId(id);
    setSelectedEvents((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setPending(true);
    try {
      // Selected ids in the form the discovery returned them, plus any stored
      // ids the walk didn't surface (an event type this environment no longer
      // lists must not be dropped silently by an unrelated edit).
      const eventIds = [
        ...(eventTypes ?? [])
          .filter((t) => selectedEvents.has(normalizeItemId(t.id)))
          .map((t) => t.id),
        ...(webhook?.eventIds ?? []).filter(
          (id) =>
            selectedEvents.has(normalizeItemId(id)) &&
            !knownEventIds.has(normalizeItemId(id)),
        ),
      ];

      const existingAuthorization =
        authChoice !== AUTH_NONE && authChoice !== AUTH_NEW
          ? authorizations.find(
              (a) => normalizeItemId(a.itemId) === authChoice,
            )
          : undefined;

      await onSubmit({
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
        enabled,
        eventIds,
        authorizationMode: isNewAuth
          ? "new"
          : existingAuthorization
            ? "existing"
            : "none",
        existingAuthorizationId: existingAuthorization?.itemId,
        newAuthorizationKey: isNewAuth ? newAuthKey.trim() : undefined,
        newAuthorizationValue: isNewAuth ? newAuthValue : undefined,
      });
      onOpenChange(false);
    } catch {
      // Caller reports the error via toast; keep the dialog open for edits.
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {webhook ? "Edit webhook" : "Create webhook"}
          </DialogTitle>
          <DialogDescription>
            The webhook definition item is stored under
            /sitecore/system/Webhooks and invoked by SitecoreAI when the
            selected events occur.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="xm-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="xm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notify build server"
              disabled={Boolean(webhook)}
            />
            {webhook && (
              <p className="text-muted-foreground text-xs">
                The item name is fixed after creation.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="xm-url" className="text-sm font-medium">
              URL
            </label>
            <Input
              id="xm-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/sitecore"
              aria-invalid={url !== "" && !urlValid}
            />
            {url !== "" && !urlValid && (
              <p className="text-danger-fg text-xs">
                The URL must start with http:// or https://
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="xm-description" className="text-sm font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="xm-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this webhook notifies and why"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Events</label>
            {groupedEvents === null ? (
              <div className="flex items-center gap-2 rounded-xl border border-border-muted p-3 text-text-subtle">
                <Icon path={mdiLoading} className="animate-spin" />
                <span className="text-sm">Discovering event types&hellip;</span>
              </div>
            ) : groupedEvents.size === 0 ? (
              <p className="text-danger-fg text-xs">
                No event types were found under
                /sitecore/system/Settings/Webhooks/Event Types.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-border-muted p-3">
                {[...groupedEvents.entries()].map(([category, types]) => (
                  <div key={category} className="flex flex-col gap-1.5">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {category}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {types.map((type) => (
                        <label
                          key={type.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={selectedEvents.has(
                              normalizeItemId(type.id),
                            )}
                            onChange={() => toggleEvent(type.id)}
                          />
                          {type.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {groupedEvents !== null &&
              groupedEvents.size > 0 &&
              selectedEvents.size === 0 && (
                <p className="text-danger-fg text-xs">
                  Select at least one event.
                </p>
              )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Authorization</label>
            <Select value={authChoice} onValueChange={setAuthChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTH_NONE}>None</SelectItem>
                {authorizations.map((auth) => (
                  <SelectItem
                    key={auth.itemId}
                    value={normalizeItemId(auth.itemId)}
                  >
                    {auth.name}
                    {auth.key ? ` (${auth.key})` : ""}
                  </SelectItem>
                ))}
                <SelectItem value={AUTH_NEW}>
                  Create new authorization&hellip;
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              An Authorization item adds a secret header to every delivery so
              the receiver can verify the sender.
            </p>
          </div>

          {isNewAuth && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border-muted p-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="xm-auth-key" className="text-sm font-medium">
                  Header name
                </label>
                <Input
                  id="xm-auth-key"
                  value={newAuthKey}
                  onChange={(e) => setNewAuthKey(e.target.value)}
                  placeholder="e.g. X-Webhook-Secret"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="xm-auth-value" className="text-sm font-medium">
                  Header value
                </label>
                <Input
                  id="xm-auth-value"
                  value={newAuthValue}
                  onChange={(e) => setNewAuthValue(e.target.value)}
                  placeholder="Secret value"
                />
              </div>
              <p className="text-muted-foreground col-span-2 text-xs">
                Stored as an Authorization item under
                /sitecore/system/Settings/Webhooks/Authorizations and sent as a
                request header.
              </p>
            </div>
          )}

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending && (
              <Icon path={mdiLoading} size={0.8} className="animate-spin" />
            )}
            {webhook ? "Save changes" : "Create webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
