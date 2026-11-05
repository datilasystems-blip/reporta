import { useEffect, useState } from "react";
import { api, friendlyError } from "../lib/api";
import { fmtDateTime, statusColor } from "../util";
import { Page, Panel } from "./Dashboard";

export function ReportDetail({ id }: { id: string }) {
  const [report, setReport] = useState<any>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/api/admin/reports/${id}`).then((r) => setReport(r.data.report)).catch((e) => setErr("Failed to load report."));
    api.get("/api/admin/officers").then((r) => setOfficers(r.data.officers.filter((o: any) => o.role === "officer" && o.status === "active"))).catch(() => { });
  }
  useEffect(load, [id]);

  if (err) return <Page title="Report"><p style={{ color: "#dc2626" }}>{err}</p></Page>;
  if (!report) return <Page title="Report"><p style={{ color: "#64748b" }}>Loading…</p></Page>;

  async function act(fn: () => Promise<any>, successMsg: string) {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); setMsg(successMsg); load(); }
    catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  const canReview = ["admin", "super_admin", "reviewer"].includes(localStorage.getItem("reporta_role") ?? "") || true;

  return (
    <Page title={`${report.reference}`} subtitle={`Case ${report.caseId} · ${report.category} · received ${fmtDateTime(report.createdAt)}`}>
      {msg && <div style={{ background: "#e9f7ee", color: "#16a34a", padding: "12px 16px", borderRadius: 10, fontWeight: 600, marginBottom: 14 }}>{msg}</div>}
      {err && <div style={{ background: "#fdecec", color: "#dc2626", padding: "12px 16px", borderRadius: 10, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18 }}>
        {/* LEFT: details */}
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="Incident details">
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={pill(statusColor(report.status))}>{report.status.replace(/_/g, " ")}</span>
              <span style={pill({ bg: "#fff7dd", fg: "#b45309" })}>{report.urgency}</span>
              <span style={pill({ bg: "#eef1f6", fg: "#475569" })}>priority: {report.priority}</span>
              {report.ongoing && <span style={pill({ bg: "#fdecec", fg: "#b91c1c" })}>ongoing</span>}
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#1f2430", whiteSpace: "pre-wrap" }}>{report.description}</p>
            <Row k="Date of incident" v={report.incidentDate ? fmtDateTime(report.incidentDate) + (report.incidentTime ? ` ${report.incidentTime}` : "") : "Not provided"} />
            <Row k="Location" v={[report.landmark, report.town, report.region].filter(Boolean).join(", ") || "Not provided"} />
            <Row k="Reporter" v={report.isAnonymous ? "Anonymous" : `${report.reporter?.name ?? "—"}${report.reporter?.phone ? ` · ${report.reporter.phone}` : ""}${report.reporter?.email ? ` · ${report.reporter.email}` : ""}`} />
            {report.perpetrator && <Row k="Alleged perpetrator (voluntarily provided)" v={[report.perpetrator.name, report.perpetrator.description].filter(Boolean).join(" — ")} />}
            {report.witness && <Row k="Witness information" v={report.witness.info} />}
          </Panel>

          <Panel title={`Evidence (${report.evidence.length})`}>
            {report.evidence.length === 0 && <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No evidence attached.</p>}
            {report.evidence.map((ev: any) => <EvidenceRow key={ev.id} ev={ev} />)}
          </Panel>

          <Panel title="Status history">
            {report.statusHistory.map((s: any) => (
              <div key={s.id} style={{ padding: "9px 0", borderBottom: "1px solid #eef1f6", fontSize: 13.5 }}>
                <strong>{s.from.replace(/_/g, " ")} → {s.to.replace(/_/g, " ")}</strong>
                <span style={{ color: "#64748b" }}> · {s.actorName} ({s.actorRole ?? "system"}) · {fmtDateTime(s.at)}</span>
                {s.reason && <div style={{ color: "#64748b", marginTop: 3 }}>{s.reason}</div>}
              </div>
            ))}
          </Panel>
        </div>

        {/* RIGHT: actions */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <Panel title="Actions">
            <div style={{ display: "grid", gap: 10 }}>
              <button disabled={busy} onClick={() => act(() => api.post(`/api/admin/reports/${id}/status`, { toStatus: "review", reason: "Marked under review" }), "Marked under review")} style={actionBtn("#1a56cc")}>Start review</button>

              <label style={labelStyle}>Set priority</label>
              <select defaultValue={report.priority} onChange={(e) => act(() => api.post(`/api/admin/reports/${id}/priority`, { priority: e.target.value }), "Priority updated")} style={selectStyle}>
                {["low", "normal", "high", "critical"].map((p) => <option key={p}>{p}</option>)}
              </select>

              <label style={labelStyle}>Assign officer</label>
              <select value={selectedOfficer} onChange={(e) => setSelectedOfficer(e.target.value)} style={selectStyle}>
                <option value="">Choose an officer…</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.staffCode ? ` (${o.staffCode})` : ""} — {o.activeCases} active</option>)}
              </select>
              <button disabled={busy || !selectedOfficer} onClick={() => act(() => api.post(`/api/admin/reports/${id}/assign`, { officerId: selectedOfficer }), "Case assigned — officer notified")} style={actionBtn("#0f9b8e")}>Assign case</button>

              <button disabled={busy} onClick={() => act(() => api.post(`/api/admin/reports/${id}/status`, { toStatus: "investigation" }), "Moved to investigation")} style={actionBtn("#6d28d9")}>Open investigation</button>
              <button disabled={busy || !closeReason.trim()} onClick={() => act(() => api.post(`/api/admin/reports/${id}/status`, { toStatus: "closed", reason: closeReason }), "Case closed")} style={actionBtn("#16a34a")}>Close case</button>
              <input placeholder="Closing reason (required to close)" value={closeReason} onChange={(e) => setCloseReason(e.target.value)} style={selectStyle} />
              {report.status === "closed" && (
                <button disabled={busy} onClick={() => act(() => api.post(`/api/admin/reports/${id}/status`, { toStatus: "review", reason: "Reopened" }), "Case reopened")} style={actionBtn("#b45309")}>Reopen case</button>
              )}
            </div>
          </Panel>

          <Panel title="Internal note (restricted)">
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to authorised staff only — never shown to the reporter."
              style={{ ...selectStyle, resize: "vertical", marginBottom: 10 }} />
            <button disabled={busy || note.trim().length < 2} onClick={() => act(() => api.post(`/api/admin/reports/${id}/notes`, { body: note }), "Internal note saved")} style={actionBtn("#475569")}>Add note</button>
            {report.internalNotes?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {report.internalNotes.map((n: any) => (
                  <div key={n.id} style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8, fontSize: 13.5 }}>
                    <strong>{n.authorName}</strong> <span style={{ color: "#64748b" }}>· {fmtDateTime(n.createdAt)}</span>
                    <p style={{ margin: "5px 0 0", color: "#1f2430" }}>{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Public update (visible to reporter)">
            <textarea rows={3} value={updateBody} onChange={(e) => setUpdateBody(e.target.value)} placeholder="Approved public-facing update…"
              style={{ ...selectStyle, resize: "vertical", marginBottom: 10 }} />
            <button disabled={busy || updateBody.trim().length < 5} onClick={() => act(() => api.post(`/api/admin/reports/${id}/updates`, { kind: "progress", body: updateBody }), "Public update posted")} style={actionBtn("#0f9b8e")}>Post update</button>
          </Panel>

          <Panel title="Request more information">
            <textarea rows={3} value={infoMsg} onChange={(e) => setInfoMsg(e.target.value)} placeholder="What additional information do you need?"
              style={{ ...selectStyle, resize: "vertical", marginBottom: 10 }} />
            <button disabled={busy || infoMsg.trim().length < 5} onClick={() => act(() => api.post(`/api/admin/reports/${id}/request-info`, { message: infoMsg }), "Information requested — reporter notified")} style={actionBtn("#d99a00")}>Request info</button>
            {report.infoRequest && (
              <div style={{ marginTop: 12, fontSize: 13.5 }}>
                <strong>Current request:</strong> {report.infoRequest.message}
                {report.infoRequest.response && <div style={{ color: "#16a34a", marginTop: 4 }}>Response: {report.infoRequest.response}</div>}
              </div>
            )}
          </Panel>

          <Panel title="Assignment history">
            {report.assignments.length === 0 && <Empty />}
            {report.assignments.map((a: any) => (
              <div key={a.id} style={{ padding: "9px 0", borderBottom: "1px solid #eef1f6", fontSize: 13.5 }}>
                <strong>{a.officerName}</strong> {a.officerCode && <span style={{ color: "#64748b" }}>({a.officerCode})</span>}
                <span style={{ color: "#64748b" }}> · {a.state} · assigned {fmtDateTime(a.at)}</span>
                {a.acknowledgedAt && <div style={{ color: "#16a34a" }}>✓ acknowledged {fmtDateTime(a.acknowledgedAt)}</div>}
                {a.note && <div style={{ color: "#64748b" }}>{a.note}</div>}
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function EvidenceRow({ ev }: { ev: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const isImage = ev.mimeType?.startsWith("image/");
  const isAudio = ev.mimeType?.startsWith("audio/");
  const isVideo = ev.mimeType?.startsWith("video/");

  async function open() {
    try {
      const r = await api.get(`/api/evidence/${ev.id}/url`);
      setUrl(r.data.url);
    } catch { setErr(true); }
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eef1f6" }}>
      <span style={{ fontSize: 22 }}>{ev.kind === "photo" ? "🖼️" : ev.kind === "video" ? "🎥" : ev.kind === "audio" ? "🎤" : "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.originalName}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{(ev.sizeBytes / 1024 / 1024).toFixed(2)} MB · {ev.mimeType} · scan: {ev.scanStatus}</div>
      </div>
      {!url && <button onClick={open} disabled={err} style={viewBtn}>{err ? "Unavailable" : "Open"}</button>}
      {url && isImage && <img src={url} alt={ev.originalName} style={{ maxWidth: 220, borderRadius: 10, border: "1px solid #e4e9f2" }} />}
      {url && isAudio && <audio controls src={url} style={{ maxWidth: 260 }} />}
      {url && isVideo && <video controls src={url} style={{ maxWidth: 280, borderRadius: 10 }} />}
      {url && !isImage && !isAudio && !isVideo && <a href={url} target="_blank" rel="noreferrer" style={viewBtn}>Download</a>}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div style={{ display: "flex", gap: 10, padding: "7px 0", fontSize: 13.5, borderBottom: "1px solid #f4f6fa" }}>
    <div style={{ minWidth: 180, color: "#64748b", fontWeight: 600 }}>{k}</div>
    <div style={{ color: "#1f2430" }}>{v}</div>
  </div>
);

function Empty() { return <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 13 }}>None yet.</p>; }

const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#475569", marginTop: 8 };
const selectStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e4e9f2", fontSize: 13.5, background: "#fff", boxSizing: "border-box" };
const viewBtn: React.CSSProperties = { background: "#eef4ff", color: "#1a56cc", border: "none", padding: "7px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12.5, textDecoration: "none" };
function actionBtn(color: string): React.CSSProperties {
  return { background: color, color: "#fff", border: "none", padding: "11px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13.5 };
}
function pill({ bg, fg }: { bg: string; fg: string }): React.CSSProperties {
  return { background: bg, color: fg, padding: "4px 11px", borderRadius: 999, fontWeight: 700, fontSize: 12 };
}
