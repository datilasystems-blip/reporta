import { useEffect, useState } from "react";
import { api, friendlyError } from "../lib/api";
import { useNav } from "../App";
import { fmtDateTime, statusColor } from "../util";

export interface ReportRow {
  id: string; reference: string; caseId: string; category: string; description: string;
  status: string; priority: string; urgency: string; ongoing: boolean; region: string | null;
  town: string | null; incidentDate: string | null; reporterName: string | null; isAnonymous: boolean;
  evidenceCount: number; evidenceKinds: string[];
  assignedOfficers: { id: string; name: string; staffCode: string | null }[];
  createdAt: string;
}

export function Reports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const pageSize = 25;
  const { go } = useNav();

  useEffect(() => {
    setLoading(true);
    const params: any = { page, pageSize, sort };
    if (search) params.search = search;
    if (status) params.status = status;
    if (category) params.category = category;
    if (priority) params.priority = priority;
    api.get("/api/admin/reports", { params })
      .then((r) => { setRows(r.data.reports); setTotal(r.data.pagination.total); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [page, search, status, category, priority, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>Reports</h1>
      <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 14 }}>{total} report{total === 1 ? "" : "s"} in the database</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <input placeholder="Search reference, description, reporter…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={inputStyle({ flex: 2, minWidth: 220 })} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={inputStyle({ minWidth: 150 })}>
          <option value="">All statuses</option>
          {["received", "review", "awaiting_reporter_input", "assigned", "investigation", "closed", "rejected"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} style={inputStyle({ minWidth: 130 })}>
          <option value="">All priorities</option>
          {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={inputStyle({ minWidth: 130 })}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {loading ? <p style={{ color: "#64748b" }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No reports match these filters.</p>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e4e9f2", borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 900 }}>
            <thead>
              <tr>{["Reference", "Category", "Status", "Priority", "Location", "Reporter", "Evidence", "Assigned", "Received"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "12px 14px", borderBottom: "2px solid #e4e9f2", color: "#64748b", fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => go("report", r.id)} style={{ cursor: "pointer" }}>
                  <td style={td}><strong>{r.reference}</strong></td>
                  <td style={td}>{r.category}</td>
                  <td style={td}><span style={pill(statusColor(r.status))}>{r.status.replace(/_/g, " ")}</span></td>
                  <td style={td}><span style={pill(priorityColor(r.priority))}>{r.priority}</span></td>
                  <td style={td}>{[r.town, r.region].filter(Boolean).join(", ") || "—"}</td>
                  <td style={td}>{r.isAnonymous ? "Anonymous" : r.reporterName ?? "—"}</td>
                  <td style={td}>{r.evidenceCount > 0 ? `${r.evidenceCount} file${r.evidenceCount > 1 ? "s" : ""}` : "—"}</td>
                  <td style={td}>{r.assignedOfficers.map((o) => o.name).join(", ") || "Unassigned"}</td>
                  <td style={td}>{fmtDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={pageBtn}>‹ Prev</button>
          <span style={{ color: "#64748b", fontSize: 13 }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={pageBtn}>Next ›</button>
        </div>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #eef1f6", color: "#1f2430" };
const pageBtn: React.CSSProperties = { padding: "8px 14px", border: "1px solid #e4e9f2", background: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 };

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 10, border: "1px solid #e4e9f2", fontSize: 13.5, background: "#fff", ...extra };
}

function pill({ bg, fg }: { bg: string; fg: string }): React.CSSProperties {
  return { background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" };
}

function priorityColor(p: string) {
  return { critical: { bg: "#fdecec", fg: "#b91c1c" }, high: { bg: "#fff7dd", fg: "#b45309" }, normal: { bg: "#eef1f6", fg: "#475569" }, low: { bg: "#eef1f6", fg: "#64748b" } }[p] ?? { bg: "#eef1f6", fg: "#64748b" };
}
