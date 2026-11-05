import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { fmtDateTime, statusColor } from "../util";

export function CaseList({ onOpen }: { onOpen: (id: string) => void }) {
  const [cases, setCases] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "urgent">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/api/officer/cases").then((r) => setCases(r.data.cases)).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    let list = cases;
    if (filter === "new") list = list.filter((c) => !c.acknowledgedAt);
    if (filter === "urgent") list = list.filter((c) => c.report.urgency === "urgent" || c.report.priority === "critical");
    if (filter === "in_progress") list = list.filter((c) => c.acknowledgedAt);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((c) => c.report.reference.toLowerCase().includes(s) || c.report.category.toLowerCase().includes(s) || c.report.description.toLowerCase().includes(s));
    }
    return list;
  }, [cases, filter, q]);

  const counts = {
    all: cases.length,
    new: cases.filter((c) => !c.acknowledgedAt).length,
    in_progress: cases.filter((c) => c.acknowledgedAt).length,
    urgent: cases.filter((c) => c.report.urgency === "urgent" || c.report.priority === "critical").length,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "#0b4f47" }}>My cases</h1>
      <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 13.5 }}>Cases assigned to you. New assignments need acknowledgement.</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input placeholder="Search reference, category, description…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ flex: 2, minWidth: 220, padding: "10px 12px", borderRadius: 10, border: "1px solid #d7e3e0", fontSize: 13.5 }} />
        {([["all", `All (${counts.all})`], ["new", `Awaiting ack (${counts.new})`], ["in_progress", `In progress (${counts.in_progress})`], ["urgent", `Urgent (${counts.urgent})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "9px 14px", borderRadius: 999, border: `1.5px solid ${filter === k ? "#0f9b8e" : "#d7e3e0"}`,
            background: filter === k ? "#e0f5f3" : "#fff", color: filter === k ? "#0b7a70" : "#475569",
            fontWeight: 700, fontSize: 12.5, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {loading ? <p style={{ color: "#64748b" }}>Loading…</p> : filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #d7e3e0", borderRadius: 14, padding: 40, textAlign: "center", color: "#94a3b8" }}>
          {cases.length === 0 ? "No cases assigned yet. New assignments appear here and trigger a notification." : "No cases match this filter."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((c) => (
            <div key={c.assignmentId} onClick={() => onOpen(c.report.id)}
              style={{ background: "#fff", border: `1px solid ${c.acknowledgedAt ? "#e2e8e6" : "#0f9b8e"}`, borderRadius: 14, padding: 18, cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start" }}>
              {!c.acknowledgedAt && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#f2b722", marginTop: 6, flexShrink: 0 }} title="Awaiting acknowledgement" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ fontSize: 15 }}>{c.report.reference}</strong>
                  <span style={pill(statusColor(c.report.status))}>{c.report.status.replace(/_/g, " ")}</span>
                  <span style={pill({ bg: "#fff7dd", fg: "#b45309" })}>{c.report.urgency}</span>
                  {c.report.isAnonymous && <span style={pill({ bg: "#eef1f6", fg: "#64748b" })}>anonymous</span>}
                </div>
                <div style={{ fontSize: 13.5, color: "#334155", marginBottom: 6 }}>{c.report.category} · {[c.report.town, c.report.region].filter(Boolean).join(", ") || "location not specified"}</div>
                <div style={{ fontSize: 13, color: "#64748b", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.report.description}</div>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>
                  Received {fmtDateTime(c.report.createdAt)} · {c.report.evidenceCount} evidence file{c.report.evidenceCount === 1 ? "" : "s"}
                  {c.acknowledgedAt ? ` · acknowledged ${fmtDateTime(c.acknowledgedAt)}` : " · awaiting your acknowledgement"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pill({ bg, fg }: { bg: string; fg: string }): React.CSSProperties {
  return { background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontWeight: 700, fontSize: 11.5 };
}
