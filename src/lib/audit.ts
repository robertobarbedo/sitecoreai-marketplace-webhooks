import { decodeJwt } from "jose";
import {
  auditLog,
  type AuditOutcome,
} from "@/src/lib/marketplace-auth/audit-log";

/**
 * Audit helpers for the sensitive /api/edge/* operations. The middleware (and
 * readCredentials) has already verified the bearer token, so its claims are
 * only decoded here to say who acted — never trusted for access decisions.
 * Log who did what: never the secret, token, webhook URI path/query, headers
 * or body.
 */

function caller(request: Request): { sub?: string; org?: string | null } {
  const match = (request.headers.get("authorization") ?? "").match(
    /^Bearer\s+(.+)$/i,
  );
  if (!match) return {};
  try {
    const claims = decodeJwt(match[1]);
    return {
      sub: claims.sub,
      org: typeof claims.org_id === "string" ? claims.org_id : null,
    };
  } catch {
    return {};
  }
}

export function outcomeForStatus(status: number): AuditOutcome {
  if (status < 400) return "allow";
  if (status === 401 || status === 403) return "deny";
  return "error";
}

/** Writes one audit line for an operation, with the caller's identity. */
export function auditOperation(
  request: Request,
  event: string,
  outcome: AuditOutcome,
  extra: Record<string, unknown> = {},
): void {
  auditLog(request, { event, outcome, ...caller(request), ...extra });
}

/** Audits a finished operation by the status it returns, then returns the response. */
export function audited<T extends Response>(
  request: Request,
  event: string,
  response: T,
  extra: Record<string, unknown> = {},
): T {
  auditOperation(request, event, outcomeForStatus(response.status), {
    status: response.status,
    ...extra,
  });
  return response;
}

/** Host of a URL for the audit log, without path, query or credentials. */
export function hostOf(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname;
  } catch {
    return undefined;
  }
}
