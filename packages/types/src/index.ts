export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: string;
  staffCode?: string | null;
  status: string;
  mustChangePassword: boolean;
  avatarUrl?: string | null;
  emailNotifications?: boolean;
}

export interface EvidenceMeta {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number | null;
  originalName: string;
  createdAt: string;
  scanStatus: string;
}

export interface CaseStatusEvent {
  id: string;
  fromStatus: string;
  toStatus: string;
  createdAt: string;
  visibility: string;
  publicLabel?: string | null;
  actorName?: string | null;
  reason?: string | null;
}

export interface CaseUpdateDto {
  id: string;
  kind: string;
  body: string;
  visibility: string;
  createdAt: string;
  authorName: string;
  authorRole: string;
}

export interface ReportDto {
  id: string;
  reference: string;
  trackingCode?: string | null;
  category: string;
  description: string;
  incidentDate?: string | null;
  incidentTime?: string | null;
  locationRegion?: string | null;
  locationTown?: string | null;
  locationLandmark?: string | null;
  ongoing: boolean;
  urgency: string;
  priority: string;
  status: string;
  caseId: string;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  evidence: EvidenceMeta[];
  statusHistory?: CaseStatusEvent[];
  updates?: CaseUpdateDto[];
  assignedOfficers?: { id: string; name: string; staffCode?: string | null }[];
  acknowledgedAt?: string | null;
  infoRequest?: { message: string; respondedAt?: string | null; response?: string | null } | null;
  // reporter-visible only
  safeContactMethod?: string;
}

export interface AdminReportDto extends ReportDto {
  reporterUserId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  perpetratorName?: string | null;
  perpetratorDesc?: string | null;
  witnessName?: string | null;
  witnessContact?: string | null;
  internalNotes?: { id: string; body: string; authorName: string; createdAt: string }[];
  assignments?: { id: string; officerName: string; officerId: string; state: string; acknowledgedAt?: string | null; createdAt: string; note?: string | null }[];
}

export interface Officer {
  id: string;
  name: string;
  email: string;
  staffCode?: string | null;
  role: string;
  status: string;
  office?: string | null;
  createdAt: string;
  activeAssignments?: number;
}
