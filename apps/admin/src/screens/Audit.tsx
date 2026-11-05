import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Page, Panel } from "./Dashboard";
import { fmtDateTime } from "../util";

export function Audit() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 50;

  useEffect(() => {
    const params: any = { page, pageSize };
    if (actionFilter) params.action = actionFilter;
    api.get("/api/admin/audit", { params }).then((r) => { setEvents(r.data.events); setTotal(r.data.total); }).catch(() => { });
  }, [page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Page title="Audit log" subtitle={`${total} recorded events — append-only, restricted access`}>
      <div style={{ marginBottom: 14 }}>
        <input placeholder="Filter by action (e.g. case., officer., evidence.)" value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e4e9f2", fontSize: 13.5, width: 340 }} />
      </div>
      <Panel title="Events">
        {events.length === 0 ? <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No audit events.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["When", "Actor", "Action", "Target", "Detail"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "9px 10px", borderBottom: "2px solid #e4e9f2", color: "#64748b", fontSize: 11.5, textTransform: "uppercase" }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: "9px 10px", borderBottom: "1px solid #f4f6fa", whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</td>
                  <td style={{ padding: "9px 10px", borderBottom: "1px solid #f4f6fa" }}>{e.actorName}{e.actorRole ? ` (${e.actorRole})` : ""}</td>
                  <td style={{ padding: "9px 10px", borderBottom: "1px solid #f4f6fa", fontWeight: 600 }}>{e.action}</td>
                  <td style={{ padding: "9px 10px", borderBottom: "1px solid #f4f6fa" }}>{e.targetType ? `${e.targetType}: ${e.targetId?.slice(0, 8)}…` : "—"}</td>
                  <td style={{ padding: "9px 10px", borderBottom: "1px solid #f4f6fa", color: "#64748b", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.detail ? JSON.stringify(e.detail) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "8px 14px", border: "1px solid #e4e9f2", borderRadius: 8, background: "#fff", cursor: "pointer" }}>‹ Prev</button>
            <span style={{ color: "#64748b", fontSize: 13 }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "8px 14px", border: "1px solid #e4e9f2", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Next ›</button>
          </div>
        )}
      </Panel>
    </Page>
  );
}
