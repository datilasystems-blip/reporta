import { useEffect, useState } from "react";
import { api, friendlyError } from "../lib/api";
import { fmtDateTime } from "../util";

export function CaseDetail({ reportId, onBack }: { reportId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // forms
  const [updateKind, setUpdateKind] = useState("progress");
  const [updateBody, setUpdateBody] = useState("");
  const [updatePublic, setUpdatePublic] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [flagKind, setFlagKind] = useState("urgent");
  const [flagNote, setFlagNote] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [infoResponse, setInfoResponse] = useState("");

  function load() {
    api.get(`/api/officer/cases/${reportId}`).then((r) => setData(r.data)).catch((e) => setErr("Failed to load case."));
  }
  useEffect(load, [reportId]);

  if (err) return <Wrap><p style={{ color: "#dc2626" }}>{err}</p><button onClick={onBack} style={btn("#475569")}>Back</button></Wrap>;
  if (!data) return <Wrap><p style={{ color: "#64748b" }}>Loading…</p></Wrap>;

  const r = data.report;

  async function act(fn: () => Promise<any>, ok: string) {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); setMsg(ok); load(); } catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Wrap>
      <button onClick={onBack} style={{ ...btn("#475569"), marginBottom: 14 }}>← Back to my cases</button>
      {msg && <Banner kind="ok">{msg}</Banner>}
      {err && <Banner kind="err">{err}</Banner>}

      <div style={{ background: "#fff", border: "1px solid #e2e8e6", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <strong style={{ fontSize: 17 }}>{r.reference}</strong>
          <span style={pill("#e0f5f3", "#0b7a70")}>{r.status.replace(/_/g, " ")}</span>
          <span style={pill("#fff7dd", "#b45309")}>{r.urgency}</span>
          <span style={pill("#eef1f6", "#475569")}>{r.priority}</span>
        </div>
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.7, color: "#1f2430" }}>{r.description}</p>
        <Detail k="Category" v={r.category} />
        <Detail k="Incident date" v={r.incidentDate ? `${fmtDateTime(r.incidentDate)}${r.incidentTime ? " " + r.incidentTime : ""}` : "Not provided"} />
        <Detail k="Location" v={[r.landmark, r.town, r.region].filter(Boolean).join(", ") || "Not provided"} />
        <Detail k="Reporter" v={r.isAnonymous ? "Anonymous" : `${r.reporter?.name ?? "—"}${r.reporter?.phone ? ` · ${r.reporter.phone}` : ""}`} />
        {r.perpetrator && <Detail k="Alleged perpetrator" v={[r.perpetrator.name, r.perpetrator.description].filter(Boolean).join(" — ")} />}
        {r.witness && <Detail k="Witness" v={r.witness.info} />}
        {!data.acknowledgedAt && (
          <button disabled={busy} onClick={() => act(() => api.post(`/api/officer/assignments/${data.assignmentId}/acknowledge`), "Assignment acknowledged")}
            style={{ ...btn("#0f9b8e"), marginTop: 14 }}>✓ Acknowledge assignment</button>
        )}
        {data.acknowledgedAt && <div style={{ color: "#16a34a", fontWeight: 600, marginTop: 10, fontSize: 13 }}>✓ Acknowledged {fmtDateTime(data.acknowledgedAt)}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Panel title="Evidence (authorised access only)">
          {r.evidence.length === 0 && <Empty text="No evidence attached." />}
          {r.evidence.map((ev: any) => <EvidenceRow key={ev.id} ev={ev} />)}
        </Panel>

        <Panel title="Record progress update">
          <select value={updateKind} onChange={(e) => setUpdateKind(e.target.value)} style={inp}>
            <option value="progress">Progress update</option>
            <option value="finding">Finding</option>
            <option value="recommendation">Recommendation</option>
          </select>
          <textarea rows={4} value={updateBody} onChange={(e) => setUpdateBody(e.target.value)} placeholder="What action did you take? What is the next step?" style={{ ...inp, resize: "vertical" }} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10 }}>
            <input type="checkbox" checked={updatePublic} onChange={(e) => setUpdatePublic(e.target.checked)} />
            Also make this visible to the reporter (public update)
          </label>
          <button disabled={busy || updateBody.trim().length < 5} onClick={() => act(() => api.post(`/api/officer/cases/${reportId}/update`, { kind: updateKind, body: updateBody, visibility: updatePublic ? "public" : "internal" }), "Update recorded")}
            style={btn("#0f9b8e")}>Save update</button>
        </Panel>

        <Panel title="Flag a concern">
          <select value={flagKind} onChange={(e) => setFlagKind(e.target.value)} style={inp}>
            <option value="urgent">Urgent — needs escalation</option>
            <option value="risk">Risk to someone's safety</option>
            <option value="conflict_of_interest">Conflict of interest</option>
            <option value="unable_to_handle">Unable to handle this case</option>
          </select>
          <textarea rows={3} value={flagNote} onChange={(e) => setFlagNote(e.target.value)} placeholder="Explain the concern…" style={{ ...inp, resize: "vertical" }} />
          <button disabled={busy} onClick={() => act(() => api.post(`/api/officer/cases/${reportId}/flag`, { flag: flagKind, note: flagNote || undefined }), "Flag submitted — administrators notified")}
            style={btn("#b45309")}>Submit flag</button>
        </Panel>

        <Panel title="Request reassignment">
          <textarea rows={3} value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Why should this case be reassigned? (min 10 chars)" style={{ ...inp, resize: "vertical" }} />
          <button disabled={busy || reassignReason.trim().length < 10} onClick={() => act(() => api.post(`/api/officer/cases/${reportId}/request-reassign`, { reason: reassignReason }), "Reassignment requested")}
            style={btn("#dc2626")}>Request reassignment</button>
        </Panel>

        {r.infoRequest && !r.infoRequest.respondedAt && (
          <Panel title="Administrator requested more information">
            <p style={{ fontSize: 13.5, color: "#1f2430" }}>{r.infoRequest.message}</p>
          </Panel>
        )}

        <Panel title="Case timeline & updates">
          {r.updates.map((u: any) => (
            <div key={u.id} style={{ background: "#f0fbfa", borderRadius: 10, padding: 12, marginBottom: 8, fontSize: 13.5 }}>
              <strong style={{ color: "#0b7a70" }}>{u.kind}</strong> <span style={{ color: "#64748b" }}>· {u.authorName} · {fmtDateTime(u.at)}</span>
              <p style={{ margin: "5px 0 0" }}>{u.body}</p>
            </div>
          ))}
          {r.statusHistory.map((s: any) => (
            <div key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid #eef1f6", fontSize: 13 }}>
              <strong>{s.from.replace(/_/g, " ")} → {s.to.replace(/_/g, " ")}</strong>
              <span style={{ color: "#64748b" }}> · {s.actorName} · {fmtDateTime(s.at)}</span>
            </div>
          ))}
          {r.updates.length === 0 && r.statusHistory.length === 0 && <Empty text="No updates yet." />}
        </Panel>
      </div>
    </Wrap>
  );
}

function EvidenceRow({ ev }: { ev: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const isImage = ev.mimeType?.startsWith("image/");
  const isAudio = ev.mimeType?.startsWith("audio/");
  const isVideo = ev.mimeType?.startsWith("video/");
  async function open() {
    try { const r = await api.get(`/api/evidence/${ev.id}/url`); setUrl(r.data.url); } catch { setErr(true); }
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eef1f6" }}>
      <span style={{ fontSize: 20 }}>{ev.kind === "photo" ? "🖼️" : ev.kind === "video" ? "🎥" : ev.kind === "audio" ? "🎤" : "📄"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.originalName}</div>
        <div style={{ fontSize: 11.5, color: "#64748b" }}>{(ev.sizeBytes / 1024 / 1024).toFixed(2)} MB · scan: {ev.scanStatus}</div>
      </div>
      {!url && <button onClick={open} disabled={err} style={viewBtn}>{err ? "Unavailable" : "Open"}</button>}
      {url && isImage && <img src={url} alt="" style={{ maxWidth: 200, borderRadius: 10, border: "1px solid #e2e8e6" }} />}
      {url && isAudio && <audio controls src={url} style={{ maxWidth: 240 }} />}
      {url && isVideo && <video controls src={url} style={{ maxWidth: 260, borderRadius: 10 }} />}
      {url && !isImage && !isAudio && !isVideo && <a href={url} target="_blank" rel="noreferrer" style={viewBtn}>Download</a>}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) { return <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>{children}</div>; }
function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13.5, borderBottom: "1px solid #f4f6fa" }}>
      <div style={{ minWidth: 170, color: "#64748b", fontWeight: 600 }}>{k}</div>
      <div style={{ color: "#1f2430" }}>{v}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: "#fff", border: "1px solid #e2e8e6", borderRadius: 14, padding: 20 }}><h3 style={{ margin: "0 0 12px", fontSize: 14.5 }}>{title}</h3>{children}</div>;
}
function Empty({ text }: { text: string }) { return <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 13 }}>{text}</p>; }
function Banner({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  const ok = kind === "ok";
  return <div style={{ background: ok ? "#e9f7ee" : "#fdecec", color: ok ? "#16a34a" : "#dc2626", padding: "12px 16px", borderRadius: 10, fontWeight: 600, marginBottom: 14 }}>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d7e3e0", fontSize: 13.5, boxSizing: "border-box", marginBottom: 10 };
const viewBtn: React.CSSProperties = { background: "#e0f5f3", color: "#0b7a70", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 };
function btn(c: string): React.CSSProperties { return { background: c, color: "#fff", border: "none", padding: "11px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13.5 }; }
function pill(bg: string, fg: string): React.CSSProperties { return { background: bg, color: fg, padding: "3px 10px", borderRadius: 999, fontWeight: 700, fontSize: 11.5 }; }
