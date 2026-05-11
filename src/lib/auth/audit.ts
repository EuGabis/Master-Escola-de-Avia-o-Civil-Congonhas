import { db } from "@/lib/db";

interface AuditInput {
  workspaceId: string;
  userId?: string | null;
  action: string;          // ex: "auth.login", "auth.login_failed", "user.create"
  target?: string | null;  // ex: id do recurso afetado
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registra um evento de auditoria.
 * Falhas de auditoria nao quebram o fluxo (best-effort logging).
 */
export async function audit(input: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        action: input.action,
        target: input.target ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] falha ao registrar:", err);
  }
}
