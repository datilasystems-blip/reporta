export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return String(iso); }
}

export function statusColor(s: string): { bg: string; fg: string } {
  return {
    received: { bg: "#fff7dd", fg: "#b45309" },
    review: { bg: "#e8f0fe", fg: "#1a56cc" },
    awaiting_reporter_input: { bg: "#fff7dd", fg: "#d99a00" },
    assigned: { bg: "#e0f2fe", fg: "#0369a1" },
    investigation: { bg: "#ede9fe", fg: "#6d28d9" },
    closed: { bg: "#e9f7ee", fg: "#16a34a" },
    rejected: { bg: "#fdecec", fg: "#dc2626" },
  }[s] ?? { bg: "#eef1f6", fg: "#475569" };
}
