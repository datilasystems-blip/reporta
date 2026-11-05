// REPORTA design tokens — extracted from the approved UI/UX mockup
export const C = {
  purple: "#5b2d8e",       // primary brand purple (shield, buttons)
  purpleDark: "#3f1f66",
  purpleDeep: "#2a1544",
  teal: "#0f9b8e",         // accent teal (icons, links, chips)
  tealDark: "#0b7a70",
  gold: "#f2b722",         // gold accent bar / highlights
  goldDark: "#d99a00",
  ink: "#1f2430",          // headings/body
  muted: "#64748b",
  line: "#e4e9f2",
  page: "#f6f7fb",         // light background
  card: "#ffffff",
  green: "#16a34a",
  red: "#dc2626",
  amberBg: "#fff7dd",
  greenBg: "#e9f7ee",
  redBg: "#fdecec",
  white: "#ffffff",
};

export const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export const BRAND = {
  name: "REPORTA",
  tagline: "Speak up. Report safely. Get support.",
};

export function money(n: number): string {
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  received: { bg: C.amberBg, fg: C.goldDark, label: "Report submitted" },
  review: { bg: "#e8f0fe", fg: "#1a56cc", label: "Under review" },
  awaiting_reporter_input: { bg: C.amberBg, fg: C.goldDark, label: "Further information requested" },
  assigned: { bg: "#e0f2fe", fg: "#0369a1", label: "Assigned for follow-up" },
  investigation: { bg: "#ede9fe", fg: "#6d28d9", label: "Under investigation" },
  closed: { bg: C.greenBg, fg: C.green, label: "Case closed" },
  rejected: { bg: C.redBg, fg: C.red, label: "Not actionable" },
};

export function statusStyle(s: string) {
  return STATUS_COLORS[s] ?? { bg: C.line, fg: C.muted, label: s };
}
