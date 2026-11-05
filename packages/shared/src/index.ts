// Shared constants & helpers used by API and all clients

export const REPORT_CATEGORIES = [
  "Theft",
  "Assault",
  "Domestic violence",
  "Child abuse",
  "Sexual violence",
  "Fraud / scam",
  "Cybercrime",
  "Kidnapping",
  "Murder / manslaughter",
  "Robbery",
  "Corruption / bribery",
  "Human trafficking",
  "Drug related",
  "Property damage",
  "Missing person",
  "Other",
] as const;

export const REPORT_STATUSES = [
  "received",
  "awaiting_review",
  "under_review",
  "assigned",
  "info_requested",
  "action_recorded",
  "referred",
  "closed",
  "reopened",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PUBLIC_STATUS_LABELS: Record<string, string> = {
  received: "Report submitted",
  awaiting_review: "Awaiting administrative review",
  under_review: "Under review",
  assigned: "Assigned for follow-up",
  info_requested: "Further information requested",
  action_recorded: "Action recorded",
  referred: "Referred to the appropriate office",
  closed: "Case closed",
  reopened: "Case reopened",
};

// Allowed server-side status transitions (from -> to)
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ["awaiting_review", "under_review", "assigned", "closed"],
  awaiting_review: ["under_review", "assigned", "closed"],
  under_review: ["assigned", "info_requested", "action_recorded", "referred", "closed"],
  assigned: ["under_review", "info_requested", "action_recorded", "referred", "closed"],
  info_requested: ["under_review", "assigned", "action_recorded", "closed"],
  action_recorded: ["under_review", "referred", "closed"],
  referred: ["under_review", "action_recorded", "closed"],
  closed: ["reopened"],
  reopened: ["under_review", "assigned", "closed"],
};

export const PRIORITIES = ["low", "normal", "high", "critical"] as const;

export const REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Central",
  "Volta",
  "Eastern",
  "Northern",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
  "Savannah",
  "North East",
  "Oti",
  "Western North",
] as const;

// Valid status transitions helper
export function canTransition(from: string, to: string): boolean {
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function publicStatusLabel(status: string): string {
  return PUBLIC_STATUS_LABELS[status] ?? status;
}

export const EVIDENCE_LIMITS = {
  photo: { maxFiles: 6, maxBytes: 8 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp", "image/heic"] },
  video: { maxFiles: 2, maxBytes: 80 * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"] },
  audio: { maxFiles: 3, maxBytes: 15 * 1024 * 1024, mimes: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav"] },
  document: { maxFiles: 4, maxBytes: 8 * 1024 * 1024, mimes: ["application/pdf"] },
};

export function isSafeEvidenceMime(kind: string, mime: string): boolean {
  const lim = (EVIDENCE_LIMITS as any)[kind];
  return lim ? lim.mimes.includes(mime) : false;
}
