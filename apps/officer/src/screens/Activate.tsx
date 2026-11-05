import { useState } from "react";
import { api, friendlyError } from "../lib/api";

export function Activate({ onDone }: { onDone: (user: any) => void }) {
  const token = new URLSearchParams(location.hash.split("?")[1] ?? "").get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return <Center><p style={{ color: "#dc2626" }}>This activation link is missing its token. Ask your administrator for a new invitation.</p></Center>;
  }

  async function submit() {
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.post("/api/auth/activate", { token, password });
      setMsg("Account activated. Signing you in…");
      setTimeout(() => onDone(r.data.user), 600);
    } catch (e) { setErr(await friendlyError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Center>
      <div style={{ background: "#fff", padding: 34, borderRadius: 16, width: 400, border: "1px solid #e4e9f2" }}>
        <h2 style={{ marginTop: 0, color: "#0b4f47" }}>Set your password</h2>
        <p style={{ color: "#64748b", fontSize: 13.5 }}>Complete your REPORTA officer account activation.</p>
        {msg && <p style={{ color: "#16a34a", fontWeight: 600 }}>{msg}</p>}
        {err && <p style={{ color: "#dc2626", fontWeight: 600 }}>{err}</p>}
        <input type="password" placeholder="New password (min 10 chars)" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 10, boxSizing: "border-box" }} />
        <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 16, boxSizing: "border-box" }} />
        <button onClick={submit} disabled={busy || password.length < 10}
          style={{ width: "100%", padding: 13, background: "#0f9b8e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? "Activating…" : "Activate account"}
        </button>
      </div>
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f7f6" }}>{children}</div>;
}
