// Response serializers — strip anything a caller is not authorised to see.
import type { Report, Evidence, CaseStatusChange, CaseUpdate, CaseAssignment } from "@prisma/client";

export interface PublicReportView {
  reference: string;
  caseId: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  timeline: {
    id: string;
    at: string;
    label: string;
  }[];
  updates: {
    id: string;
    at: string;
    body: string;
  }[];
  infoRequest?: { message: string; respondedAt: string | null } | null;
  evidenceRequested?: never;
}

export function publicReportView(
  report: Report,
  events: CaseStatusChange[],
  updates: CaseUpdate[],
  infoRequest?: { message: string; response?: string | null; respondedAt?: Date | null } | null,
): PublicReportView {
  return {
    reference: report.reference,
    caseId: report.caseId,
    category: report.category,
    status: report.status,
    priority: report.priority,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    acknowledgedAt: report.acknowledgedAt?.toISOString() ?? null,
    timeline: events.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      label: e.publicLabel ?? e.toStatus,
    })),
    updates: updates.map((u) => ({
      id: u.id,
      at: u.createdAt.toISOString(),
      body: u.body,
    })),
    infoRequest: infoRequest
      ? { message: infoRequest.message, respondedAt: infoRequest.respondedAt?.toISOString() ?? null }
      : null,
  };
}

export function evidenceMeta(e: Evidence) {
  return {
    id: e.id,
    kind: e.kind,
    mimeType: e.mimeType,
    sizeBytes: e.sizeBytes,
    durationSec: e.durationSec,
    originalName: e.originalName,
    createdAt: e.createdAt.toISOString(),
    scanStatus: e.scanStatus,
  };
}

export function assignmentView(a: CaseAssignment & { officer: { id: string; name: string; staffCode: string | null } }) {
  return {
    id: a.id,
    officerId: a.officer.id,
    officerName: a.officer.name,
    officerCode: a.officer.staffCode,
    state: a.state,
    note: a.note,
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}
