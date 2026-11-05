import { useState } from "react";
import { api, setAccessToken, friendlyError } from "../lib/api";
import type { Me } from "../App";

export function Login({ onSignedIn }: { onSignedIn: (m: Me) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post("/api/auth/login", { email, password });
      setAccessToken(r.data.accessToken);
      onSignedIn(r.data.user);
    } catch (e) {
      setErr(await friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#2a1544,#5b2d8e)" }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 36, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontWeight: 900, fontSize: 26, letterSpacing: ".04em", color: "#3f1f66", marginBottom: 4 }}>
          REPORT<span style={{ color: "#f2b722" }}>A</span>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 26 }}>Ministry Administration Portal — authorised personnel only</div>
        {err && <div style={{ background: "#fdecec", color: "#dc2626", padding: 12, borderRadius: 10, fontSize: 13.5, marginBottom: 14, fontWeight: 600 }}>{err}</div>}
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Official email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 14, boxSizing: "border-box", fontSize: 14 }} />
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 18, boxSizing: "border-box", fontSize: 14 }} />
        <button onClick={submit} disabled={busy || !email || !password}
          style={{ width: "100%", padding: 13, background: "#5b2d8e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
