"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { mdiPlus, mdiRefresh, mdiLoading, mdiWebhook } from "@mdi/js";
import { Icon } from "@/lib/icon";
import { Button } from "@/components/ui/button";
import { AuthoringWebhookTable } from "./authoring-webhook-table";
import { AuthoringWebhookFormDialog } from "./authoring-webhook-form-dialog";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import {
  listXmWebhooks,
  listXmAuthorizations,
  createXmWebhook,
  updateXmWebhook,
  setXmWebhookEnabled,
  deleteXmWebhook,
} from "@/src/utils/xm-webhooks";
import {
  discoverEventTypes,
  type WebhookEventType,
} from "@/src/utils/webhook-events";
import type { XmAuthorization, XmWebhook, XmWebhookInput } from "@/src/types/xm";

interface AuthoringWebhooksTabProps {
  client: ClientSDK;
  contextId: string;
  showToast: (
    title: string,
    description?: string,
    variant?: "default" | "success" | "error" | "warning",
  ) => void;
}

export function AuthoringWebhooksTab({
  client,
  contextId,
  showToast,
}: AuthoringWebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<XmWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  /** null until the (slow, recursive) discovery walk completes. */
  const [eventTypes, setEventTypes] = useState<WebhookEventType[] | null>(null);
  const [authorizations, setAuthorizations] = useState<XmAuthorization[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<XmWebhook | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleError = useCallback(
    (error: unknown, action: string) => {
      console.error(`Error ${action}:`, error);
      showToast(
        `Failed to ${action}`,
        error instanceof Error ? error.message : undefined,
        "error",
      );
    },
    [showToast],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, auths] = await Promise.all([
        listXmWebhooks(client, contextId),
        listXmAuthorizations(client, contextId),
      ]);
      setWebhooks(list);
      setAuthorizations(auths);
    } catch (error) {
      handleError(error, "load webhooks");
    } finally {
      setLoading(false);
    }
  }, [client, contextId, handleError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The event-type walk is a handful of sequential GraphQL calls, so it runs
  // once alongside the first list load instead of on every refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await discoverEventTypes(client, contextId);
        if (!cancelled) setEventTypes(types);
      } catch (error) {
        console.error("Error discovering event types:", error);
        if (!cancelled) {
          setEventTypes([]);
          showToast(
            "Could not discover event types",
            "Existing webhooks are listed, but the event picker is unavailable.",
            "warning",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, contextId, showToast]);

  const handleSubmit = async (input: XmWebhookInput) => {
    try {
      if (selected) {
        await updateXmWebhook(client, contextId, selected, input);
        showToast("Webhook updated", selected.name, "success");
      } else {
        await createXmWebhook(client, contextId, input);
        showToast("Webhook created", input.name, "success");
      }
      await refresh();
    } catch (error) {
      handleError(error, selected ? "update webhook" : "create webhook");
      throw error;
    }
  };

  const handleToggleEnabled = async (webhook: XmWebhook) => {
    setTogglingId(webhook.itemId);
    try {
      await setXmWebhookEnabled(client, contextId, webhook, !webhook.enabled);
      setWebhooks((list) =>
        list.map((w) =>
          w.itemId === webhook.itemId ? { ...w, enabled: !webhook.enabled } : w,
        ),
      );
      showToast(
        webhook.enabled ? "Webhook disabled" : "Webhook enabled",
        webhook.name,
        "success",
      );
    } catch (error) {
      handleError(error, webhook.enabled ? "disable webhook" : "enable webhook");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      const deleted = await deleteXmWebhook(client, contextId, selected);
      if (!deleted) {
        throw new Error("Sitecore reported the delete as unsuccessful");
      }
      showToast("Webhook deleted", selected.name, "success");
      await refresh();
    } catch (error) {
      handleError(error, "delete webhook");
      throw error;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-muted bg-white p-4">
        <p className="text-sm text-text-subtle">
          Webhook definition items under /sitecore/system/Webhooks, invoked by
          SitecoreAI when authoring events such as item saves or publishes
          occur.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <Icon path={mdiRefresh} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Icon path={mdiPlus} />
            New webhook
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-subtle">
          <Icon path={mdiLoading} className="animate-spin" />
          Loading webhooks&hellip;
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border-muted bg-white py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-bg text-primary-fg">
            <Icon path={mdiWebhook} size={1} />
          </div>
          <div>
            <p className="font-bold">No webhooks yet</p>
            <p className="text-sm text-text-subtle">
              Create a webhook to notify your systems when authoring events
              occur.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setSelected(null);
              setFormOpen(true);
            }}
          >
            <Icon path={mdiPlus} />
            New webhook
          </Button>
        </div>
      ) : (
        <AuthoringWebhookTable
          webhooks={webhooks}
          eventTypes={eventTypes}
          authorizations={authorizations}
          togglingId={togglingId}
          onToggleEnabled={handleToggleEnabled}
          onEdit={(w) => {
            setSelected(w);
            setFormOpen(true);
          }}
          onDelete={(w) => {
            setSelected(w);
            setDeleteOpen(true);
          }}
        />
      )}

      <AuthoringWebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={selected}
        eventTypes={eventTypes}
        authorizations={authorizations}
        onSubmit={handleSubmit}
      />

      <ConfirmDestructiveDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete webhook"
        description={
          <>
            This permanently deletes the webhook item{" "}
            <strong>{selected?.name}</strong> from the content tree. A linked
            Authorization item is left in place, since it can be shared with
            other webhooks.
          </>
        }
        confirmLabel="Delete webhook"
        onConfirm={handleDelete}
      />
    </div>
  );
}
