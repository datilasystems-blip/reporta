export interface PublicReportView {
  reference: string;
  caseId: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  timeline: { id: string; at: string; label: string }[];
  updates: { id: string; at: string; body: string }[];
  infoRequest?: { message: string; respondedAt: string | null } | null;
}
