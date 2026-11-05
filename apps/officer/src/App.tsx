import { useEffect, useState } from "react";
import { api, setAccessToken, getAccessToken, friendlyError } from "./lib/api";
import { Login } from "./screens/Login";
import { Activate } from "./screens/Activate";
import { CaseList } from "./screens/CaseList";
import { CaseDetail } from "./screens/CaseDetail";

export interface Me { id: string; email: string; name: string; role: string; staffCode: string | null; mustChangePassword: boolean; status: string }

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);

  const isActivate = location.hash.includes("activate");

  useEffect(() => {
    if (isActivate) { setBooting(false); return; }
    if (!getAccessToken()) { setBooting(false); return; }
    api.get("/api/auth/me").then((r) => setMe(r.data.user)).catch(() => setAccessToken(null)).finally(() => setBooting(false));
  }, []);

  if (isActivate) return <Activate onDone={(u) => { setMe(u); location.hash = ""; }} />;
  if (booting) return <Shell><p style={{ color: "#64748b" }}>Loading…</p></Shell>;
  if (!me) return <Login onSignedIn={setMe} />;
  if (me.role !== "officer") {
    return <Shell><p style={{ color: "#dc2626" }}>This portal is for case officers. Your role: {me.role}.</p></Shell>;
  }

  return (
    <Shell>
      <header style={{ background: "#0b7a70", color: "#fff", padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={{ fontWeight: 900, fontSize: 19, letterSpacing: ".03em" }}>REPORT<span style={{ color: "#f2b722" }}>A</span></span>
          <span style={{ marginLeft: 10, fontSize: 12.5, color: "rgba(255,255,255,.75)" }}>Officer Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right", fontSize: 12.5 }}>
            <div style={{ fontWeight: 700 }}>{me.name}</div>
            <div style={{ color: "rgba(255,255,255,.7)" }}>{me.staffCode ?? me.email}</div>
          </div>
          <button onClick={async () => { await api.post("/api/auth/logout"); setAccessToken(null); setMe(null); }}
            style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.35)", color: "#fff", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12.5 }}>
            Sign out
          </button>
        </div>
      </header>

      {selectedCase
        ? <CaseDetail reportId={selectedCase} onBack={() => setSelectedCase(null)} />
        : <CaseList onOpen={setSelectedCase} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f7f6", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      {children}
    </div>
  );
}

export { friendlyError };
