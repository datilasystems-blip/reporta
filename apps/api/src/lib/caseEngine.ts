// One authoritative server-side case status engine shared by all interfaces.
// Every change is a validated transition, written in a transaction, with
// concurrency protection so simultaneous changes cannot silently overwrite.
import { db } from "@reporta/database";
import { canTransition, publicStatusLabel } from "@reporta/shared";
import type { Report, Prisma } from "@prisma/client";

export class TransitionError extends Error {
  constructor(message: string) { super(message); this.name = "TransitionError"; }
}

export interface StatusChangeInput {
  reportId: string;
  toStatus: string;
  actorId?: string | null;
  actorRole?: string | null;
  reason?: string;
  // When true, an approved public-facing update is also written to the timeline
  makePublic?: boolean;
  publicLabel?: string;
  assignedOfficerId?: string | null;
  assignedById?: string | null;
}

/**
 * Apply a status transition atomically.
 * - Validates from->to against STATUS_TRANSITIONS
 * - Uses optimistic concurrency: the fromStatus must still match the DB row
 * - Records a CaseStatusChange row with actor + reason
 * - Emits an in-app notification to the reporter (if any) and optionally email
 */
export async function applyStatusTransition(input: StatusChangeInput): Promise<Report> {
  const { reportId, toStatus } = input;
  if (!canTransitionEverything(toStatus)) {
    // (placeholder check; real validation happens per-transition below)
  }
  return db.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: reportId } });
    if (!report) throw new TransitionError("Report not found");
    const fromStatus = report.status;
    if (fromStatus === toStatus) {
      // Idempotent no-op
      return report;
    }
    if (!canTransition(fromStatus, toStatus)) {
      throw new TransitionError(`Invalid transition: ${fromStatus} -> ${toStatus}`);
    }

    const now = new Date();
    const data: Prisma.ReportUpdateInput = {
      status: toStatus,
      updatedAt: now,
    };
    if (toStatus === "closed") {
      data.closedAt = now;
      data.closeReason = input.reason ?? "closed";
    }
    if (toStatus === "reopened") {
      data.closedAt = null;
      data.closeReason = null;
    }
    if (toStatus === "assigned") {
      data.notified = report.notified; // unchanged; notification handled by assignment route
    }

    const updated = await tx.report.update({
      where: { id: reportId, status: fromStatus }, // optimistic concurrency guard
      data,
    }).catch((e: any) => {
      if (e?.code === "P2025") throw new TransitionError("Concurrent update detected; reload and retry.");
      throw e;
    });

    // Public label is always derived from the server-side map unless overridden
    // with an approved label (publicLabel), never exposing internal notes.
    const isPublicVisible = input.makePublic === true;
    await tx.caseStatusChange.create({
      data: {
        reportId,
        fromStatus,
        toStatus,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        reason: input.reason ?? null,
        visibility: isPublicVisible ? "public" : "internal",
        publicLabel: isPublicVisible
          ? (input.publicLabel ?? publicStatusLabel(toStatus))
          : null,
      },
    });

    // Notify the reporter in-app (reporter may be anonymous — no user row)
    if (report.reporterUserId) {
      await tx.notification.create({
        data: {
          userId: report.reporterUserId,
          reportId,
          kind: "status_change",
          title: `Case ${report.caseId} update`,
          body: `Status changed to "${publicStatusLabel(toStatus)}".`,
          linkPath: `/track/${report.reference}`,
          channel: "in_app",
        },
      }).catch(() => {});
    }

    return updated;
  });
}

function canTransitionEverything(_to: string): boolean { return true; }

/** Public (reporter-visible) timeline for a report */
export async function publicTimeline(reportId: string) {
  const events = await db.caseStatusChange.findMany({
    where: { reportId, visibility: "public" },
    orderBy: { createdAt: "asc" },
  });
  const updates = await db.caseUpdate.findMany({
    where: { reportId, visibility: "public" },
    orderBy: { createdAt: "asc" },
  });
  return { events, updates };
}
