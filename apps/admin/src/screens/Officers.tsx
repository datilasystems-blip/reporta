import { useEffect, useState } from "react";
import { api, friendlyError } from "../lib/api";
import { Page, Panel } from "./Dashboard";
import { fmtDateTime } from "../util";

export function Officers() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "officer", office: "", staffCode: "" });
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() { api.get("/api/admin/officers").then((r) => setOfficers(r.data.officers)).catch((e) => setErr("Failed to load officers.")); }
  useEffect(load, []);

  async function invite() {
    setBusy(true); setErr(null); setMsg(null); setInviteUrl(null);
    try {
      const r = await api.post("/api/admin/officers/invite", {
        name: form.name, email: form.email, role: form.role,
        office: form.office || undefined, staffCode: form.staffCode || undefined,
      });
      setMsg(`Invitation created for ${form.email}. Expires ${fmtDateTime(r.data.expiresAt)}.`);
      if (r.data.acceptUrl) setInviteUrl(r.data.acceptUrl); // shown only when email is not configured
      setForm({ name: "", email: "", role: "officer", office: "", staffCode: "" });
      load();
    } catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true); setErr(null);
    try { await api.post(`/api/admin/officers/${id}/status`, { status, reason: `Set to ${status} via admin portal` }); load(); }
    catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  async function revokeSessions(id: string) {
    setBusy(true);
    try { await api.post(`/api/admin/officers/${id}/revoke-sessions`); load(); }
    catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Page title="Officer management" subtitle="Create invited staff accounts, control access, and review workloads">
      {msg && <div style={{ background: "#e9f7ee", color: "#16a34a", padding: "12px 16px", borderRadius: 10, fontWeight: 600, marginBottom: 14 }}>{msg}</div>}
      {inviteUrl && (
        <div style={{ background: "#fff7dd", border: "1px solid #f0dfae", padding: "14px 16px", borderRadius: 10, marginBottom: 14, wordBreak: "break-all" }}>
          <strong style={{ color: "#7a5c00" }}>Email is not configured — share this activation link with the officer directly:</strong>
          <div style={{ marginTop: 6 }}><code>{inviteUrl}</code></div>
        </div>
      )}
      {err && <div style={{ background: "#fdecec", color: "#dc2626", padding: "12px 16px", borderRadius: 10, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Panel title="Invite a new staff account">
          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
            <input placeholder="Official email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inp}>
              <option value="officer">Case Officer</option>
              <option value="reviewer">Case Reviewer</option>
              <option value="admin">Administrator</option>
            </select>
            <input placeholder="Office / region (optional)" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} style={inp} />
            <input placeholder="Officer identifier, e.g. OFF-GA-014 (optional)" value={form.staffCode} onChange={(e) => setForm({ ...form, staffCode: e.target.value })} style={inp} />
            <button disabled={busy || !form.name || !form.email} onClick={invite} style={btn("#5b2d8e")}>Send secure invitation</button>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              The officer receives an expiring activation link (72h) to set their own password. Passwords are never displayed or emailed in plaintext.
            </p>
          </div>
        </Panel>

        <Panel title={`Staff accounts (${officers.length})`}>
          {officers.length === 0 && <p style={{ color: "#94a3b8", fontStyle: "italic" }}>No staff accounts yet.</p>}
          {officers.map((o) => (
            <div key={o.id} style={{ border: "1px solid #eef1f6", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{o.name}</div>
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>{o.email}{o.staffCode ? ` · ${o.staffCode}` : ""}{o.office ? ` · ${o.office}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {o.role.replace("_", " ")} · <span style={{ fontWeight: 700, color: o.status === "active" ? "#16a34a" : o.status === "invited" ? "#b45309" : "#dc2626" }}>{o.status}</span>
                    {o.lastLoginAt && ` · last login ${fmtDateTime(o.lastLoginAt)}`}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{o.activeCases} active case{o.activeCases === 1 ? "" : "s"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {o.status !== "active" && <button onClick={() => setStatus(o.id, "active")} disabled={busy} style={btnSm("#16a34a")}>Activate</button>}
                  {o.status === "active" && <button onClick={() => setStatus(o.id, "suspended")} disabled={busy} style={btnSm("#b45309")}>Suspend</button>}
                  {o.status !== "deactivated" && <button onClick={() => setStatus(o.id, "deactivated")} disabled={busy} style={btnSm("#dc2626")}>Deactivate</button>}
                  <button onClick={() => revokeSessions(o.id)} disabled={busy} style={btnSm("#475569")}>Revoke sessions</button>
                </div>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </Page>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid #e4e9f2", fontSize: 13.5, boxSizing: "border-box" };
function btn(c: string): React.CSSProperties { return { background: c, color: "#fff", border: "none", padding: "12px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }; }
function btnSm(c: string): React.CSSProperties { return { background: c, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 12 }; }
