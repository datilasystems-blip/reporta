import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useNav } from "../App";
import { fmtDateTime, statusColor } from "../util";

interface Overview {
  metrics: {
    total: number; received: number; review: number; awaitingReporter: number;
    assigned: number; investigation: number; closed: number; rejected: number;
    urgent: number; todayCount: number; weekCount: number; monthCount: number; overdue: number;
    byCategory: { category: string; count: number }[];
    byStatus: { status: string; count: number }[];
    byRegion: { region: string; count: number }[];
    officerWorkload: { officerId: string; name: string; staffCode: string | null; activeCases: number }[];
  };
  recentReports: { id: string; reference: string; category: string; status: string; priority: string; region: string | null; createdAt: string; isAnonymous: boolean }[];
}

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const { go } = useNav();

  useEffect(() => {
    api.get("/api/admin/overview").then((r) => setData(r.data)).catch(() => { });
  }, []);

  if (!data) return <Page title="Dashboard"><p style={{ color: "#64748b" }}>Loading metrics…</p></Page>;

  const m = data.metrics;
  const maxCat = Math.max(1, ...m.byCategory.map((c) => c.count));

  const cards = [
    { label: "Total reports", value: m.total, tone: "#5b2d8e" },
    { label: "New / received", value: m.received, tone: "#f2b722" },
    { label: "Urgent open", value: m.urgent, tone: "#dc2626" },
    { label: "Under review", value: m.review, tone: "#1a56cc" },
    { label: "Assigned", value: m.assigned, tone: "#0369a1" },
    { label: "Investigation", value: m.investigation, tone: "#6d28d9" },
    { label: "Awaiting info", value: m.awaitingReporter, tone: "#d99a00" },
    { label: "Closed", value: m.closed, tone: "#16a34a" },
    { label: "Overdue (>14d)", value: m.overdue, tone: "#b91c1c" },
    { label: "Today", value: m.todayCount, tone: "#0f9b8e" },
    { label: "This week", value: m.weekCount, tone: "#0f9b8e" },
    { label: "This month", value: m.monthCount, tone: "#0f9b8e" },
  ];

  return (
    <Page title="Dashboard" subtitle="Live figures from the REPORTA database">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #e4e9f2", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>{c.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: c.tone, lineHeight: 1.2 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginBottom: 28 }}>
        <Panel title="Reports by category">
          {m.byCategory.length === 0 && <Empty />}
          {m.byCategory.sort((a, b) => b.count - a.count).map((c) => (
            <Bar key={c.category} label={c.category} value={c.count} max={maxCat} color="#5b2d8e" />
          ))}
        </Panel>
        <Panel title="Officer workload (active cases)">
          {m.officerWorkload.length === 0 && <Empty />}
          {m.officerWorkload.sort((a, b) => b.activeCases - a.activeCases).map((o) => (
            <Bar key={o.officerId} label={`${o.name}${o.staffCode ? ` (${o.staffCode})` : ""}`} value={o.activeCases} max={Math.max(1, ...m.officerWorkload.map((x) => x.activeCases))} color="#0f9b8e" />
          ))}
        </Panel>
      </div>

      <Panel title="Recent activity">
        {data.recentReports.length === 0 ? <Empty /> : (
          <table style={tableStyle}>
            <thead><tr>{["Reference", "Category", "Status", "Priority", "Region", "Received"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {data.recentReports.map((r) => (
                <tr key={r.id} onClick={() => go("report", r.id)} style={{ cursor: "pointer" }}>
                  <td style={tdStyle}><strong>{r.reference}</strong>{r.isAnonymous && <span style={{ color: "#64748b", fontSize: 11 }}> · anonymous</span>}</td>
                  <td style={tdStyle}>{r.category}</td>
                  <td style={tdStyle}><span style={pillStyle(statusColor(r.status))}>{r.status}</span></td>
                  <td style={tdStyle}>{r.priority}</td>
                  <td style={tdStyle}>{r.region ?? "—"}</td>
                  <td style={tdStyle}>{fmtDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  );
}

export function Page({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 24, color: "#1f2430" }}>{title}</h1>
      {subtitle && <p style={{ margin: "0 0 22px", color: "#64748b", fontSize: 14 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e4e9f2", borderRadius: 14, padding: 20 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#1f2430" }}>{title}</h3>
      {children}
    </div>
  );
}

export function Empty() {
  return <p style={{ color: "#94a3b8", fontSize: 13.5, fontStyle: "italic" }}>No data yet.</p>;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#1f2430", marginBottom: 3 }}>
        <span>{label}</span><strong>{value}</strong>
      </div>
      <div style={{ height: 7, background: "#eef1f6", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

export const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13.5 };
export const thStyle: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #e4e9f2", color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" };
export const tdStyle: React.CSSProperties = { padding: "11px 12px", borderBottom: "1px solid #eef1f6", color: "#1f2430" };
export function pillStyle({ bg, fg }: { bg: string; fg: string }): React.CSSProperties {
  return { background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
}
