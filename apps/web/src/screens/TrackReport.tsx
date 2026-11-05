// Track a report — reference + tracking-code verification, public timeline only
import { useState } from "react";
import { api, friendlyError } from "../lib/api";
import { C, fmtDateTime } from "../theme";
import { Button, Card, Field, Notice } from "../ui";
import type { PublicReportView } from "../types";

export function TrackReport() {
  const [reference, setReference] = useState("");
  const [tracking, setTracking] = useState("");
  const [report, setReport] = useState<PublicReportView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);

  async function lookup() {
    setBusy(true); setErr(null); setReport(null); setReplySent(false);
    try {
      const res = await api.get(`/api/reports/track/${encodeURIComponent(reference.trim())}`, {
        params: tracking.trim() ? { t: tracking.trim().toUpperCase() } : {},
      });
      setReport(res.data.report);
    } catch (e) {
      setErr(await friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendInfo() {
    if (!report) return;
    setBusy(true);
    try {
      await api.post(`/api/reports/${report.reference}/provide-info?t=${encodeURIComponent(tracking.trim())}`, { message: replyText });
      setReplySent(true);
      setReplyText("");
      await lookup();
    } catch (e) {
      setErr(await friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 20px" }}>
      <h1 style={{ color: C.purple, fontSize: 26, marginBottom: 4 }}>Track your report</h1>
      <p style={{ color: C.muted, marginBottom: 22 }}>
        Enter your reference number. Anonymous reporters also need the tracking code shown at submission.
      </p>

      {!report && (
        <Card>
          {err && <Notice kind="error">{err}</Notice>}
          <Field label="Reference number" required value={reference} onChange={setReference} placeholder="RPT-XXXX-XXXX" />
          <Field label="Tracking code (anonymous reports)" value={tracking} onChange={setTracking} placeholder="16-character code" hint="Only needed if you reported anonymously." />
          <Button full disabled={!reference.trim() || busy} onClick={lookup}>{busy ? "Checking…" : "Check status"}</Button>
        </Card>
      )}

      {report && (
        <>
          <Card style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>REFERENCE</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.purple }}>{report.reference}</div>
              </div>
              <StatusChip status={report.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13.5, color: C.muted }}>
              <div><strong style={{ color: C.ink }}>Category:</strong> {report.category}</div>
              <div><strong style={{ color: C.ink }}>Case ID:</strong> {report.caseId}</div>
              <div><strong style={{ color: C.ink }}>Submitted:</strong> {fmtDateTime(report.createdAt)}</div>
              <div><strong style={{ color: C.ink }}>Last update:</strong> {fmtDateTime(report.updatedAt)}</div>
            </div>
          </Card>

          <Card style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0, color: C.ink }}>Case timeline</h3>
            {report.timeline.length === 0 && <p style={{ color: C.muted }}>No public updates yet.</p>}
            {report.timeline.map((e, i) => (
              <div key={e.id} style={{ display: "flex", gap: 14, padding: "10px 0" }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%", background: C.teal, marginTop: 5, flexShrink: 0,
                  outline: `3px solid ${i === report.timeline.length - 1 ? "#d5f0ee" : "transparent"}`,
                }} />
                <div>
                  <div style={{ fontWeight: 700, color: C.ink, fontSize: 14 }}>{e.label}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmtDateTime(e.at)}</div>
                </div>
              </div>
            ))}
            {report.updates.map((u) => (
              <div key={u.id} style={{ background: "#f0fbfa", borderRadius: 12, padding: 14, marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: C.tealDark, fontSize: 13 }}>Update from the team</div>
                <p style={{ margin: "6px 0 0", color: C.ink, fontSize: 14, lineHeight: 1.6 }}>{u.body}</p>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>{fmtDateTime(u.at)}</div>
              </div>
            ))}
            {report.infoRequest && (
              <div style={{ background: C.amberBg, borderRadius: 12, padding: 14, marginTop: 12 }}>
                <div style={{ fontWeight: 700, color: "#7a5c00", fontSize: 13 }}>Further information requested</div>
                <p style={{ margin: "6px 0 0", color: C.ink, fontSize: 14 }}>{report.infoRequest.message}</p>
              </div>
            )}
          </Card>

          {report.status === "awaiting_reporter_input" && report.infoRequest && (
            <Card style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0, color: C.ink }}>Provide the requested information</h3>
              {replySent && <Notice kind="success">Your response was sent. Thank you.</Notice>}
              <textarea
                rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your response…" style={{
                  width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${C.line}`,
                  fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", marginBottom: 12,
                }}
              />
              <Button full disabled={replyText.trim().length < 5 || busy} onClick={sendInfo}>Send response</Button>
            </Card>
          )}

          <Button kind="ghost" full onClick={() => { setReport(null); setReference(""); setTracking(""); }}>Track another report</Button>
        </>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; l: string }> = {
    received: { bg: C.amberBg, fg: C.goldDark, l: "Report submitted" },
    review: { bg: "#e8f0fe", fg: "#1a56cc", l: "Under review" },
    awaiting_reporter_input: { bg: C.amberBg, fg: C.goldDark, l: "Info requested" },
    assigned: { bg: "#e0f2fe", fg: "#0369a1", l: "Assigned for follow-up" },
    investigation: { bg: "#ede9fe", fg: "#6d28d9", l: "Under investigation" },
    closed: { bg: C.greenBg, fg: C.green, l: "Case closed" },
    rejected: { bg: C.redBg, fg: C.red, l: "Not actionable" },
  };
  const s = map[status] ?? { bg: C.line, fg: C.muted, l: status };
  return <span style={{ background: s.bg, color: s.fg, padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 12.5 }}>{s.l}</span>;
}
