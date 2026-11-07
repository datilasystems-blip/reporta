import { useEffect, useState, createContext, useContext } from "react";
import { api, setAccessToken, getAccessToken } from "./lib/api";
import { Login } from "./screens/Login";
import { Dashboard } from "./screens/Dashboard";
import { Reports } from "./screens/Reports";
import { ReportDetail } from "./screens/ReportDetail";
import { Officers } from "./screens/Officers";
import { Audit } from "./screens/Audit";

export interface Me { id: string; email: string; name: string; role: string; mustChangePassword: boolean; status: string }

const NavCtx = createContext<{ page: string; go: (p: string, arg?: string) => void; arg?: string }>({ page: "dashboard", go: () => { } });
export const useNav = () => useContext(NavCtx);

const NAV = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reports", label: "Reports" },
  { key: "officers", label: "Officers", roles: ["admin", "super_admin"] },
  { key: "audit", label: "Audit log", roles: ["admin", "super_admin", "auditor"] },
];

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [arg, setArg] = useState<string | undefined>();

  useEffect(() => {
    if (!getAccessToken()) { setBooting(false); return; }
    api.get("/api/auth/me").then((r) => setMe(r.data.user)).catch(() => setAccessToken(null)).finally(() => setBooting(false));
  }, []);

  function go(p: string, a?: string) { setPage(p); setArg(a); }
  function signOut() { api.post("/api/auth/logout"); setAccessToken(null); setMe(null); }

  if (booting) return <Centered>Loading…</Centered>;

  if (!me) return <Login onSignedIn={setMe} />;

  if (me.mustChangePassword) return <ForcePasswordChange me={me} onDone={setMe} />;

  const isStaffAdmin = ["admin", "super_admin"].includes(me.role);
  if (!isStaffAdmin && !["reviewer", "auditor"].includes(me.role)) {
    return <Centered>Your account ({me.role}) does not have admin-portal access.</Centered>;
  }

  return (
    <NavCtx.Provider value={{ page, go, arg }}>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
        <Sidebar me={me} page={page} go={go} signOut={signOut} />
        <div style={{ flex: 1, background: "#f6f7fb", minWidth: 0 }}>
          {page === "dashboard" && <Dashboard />}
          {page === "reports" && <Reports />}
          {page === "report" && arg && <ReportDetail id={arg} />}
          {page === "officers" && isStaffAdmin && <Officers />}
          {page === "audit" && <Audit />}
        </div>
      </div>
    </NavCtx.Provider>
  );
}

function Sidebar({ me, page, go, signOut }: { me: Me; page: string; go: (p: string) => void; signOut: () => void }) {
  return (
    <aside style={{ width: 232, background: "#2a1544", color: "#fff", padding: "20px 14px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4, letterSpacing: ".03em" }}>REPORT<span style={{ color: "#f2b722" }}>A</span></div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginBottom: 26 }}>Ministry Admin Portal</div>
      <nav style={{ display: "grid", gap: 4 }}>
        {NAV.filter((n) => !n.roles || n.roles.includes(me.role)).map((n) => (
          <button
            key={n.key}
            onClick={() => go(n.key)}
            style={{
              textAlign: "left", padding: "11px 14px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 14,
              background: page === n.key || (page === "report" && n.key === "reports") ? "rgba(255,255,255,.14)" : "transparent",
              color: page === n.key || (page === "report" && n.key === "reports") ? "#f2b722" : "#fff",
            }}
          >{n.label}</button>
        ))}
      </nav>
      <div style={{ marginTop: "auto", fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>
        <div style={{ fontWeight: 700, color: "#fff" }}>{me.name}</div>
        <div>{me.email}</div>
        <div style={{ color: "#f2b722", textTransform: "capitalize", marginTop: 2 }}>{me.role.replace("_", " ")}</div>
        <button onClick={() => signOut()}
          style={{ marginTop: 10, background: "transparent", border: "1px solid rgba(255,255,255,.3)", color: "#fff", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12.5 }}
        >Sign out</button>
      </div>
    </aside>
  );
}

function ForcePasswordChange({ me, onDone }: { me: Me; onDone: (m: Me) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Centered>
      <div style={{ background: "#fff", padding: 32, borderRadius: 16, maxWidth: 420, border: "1px solid #e4e9f2" }}>
        <h2 style={{ marginTop: 0 }}>Change your password</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>This is your first sign-in. Choose a new password to continue.</p>
        {msg && <p style={{ color: "#16a34a" }}>{msg}</p>}
        {err && <p style={{ color: "#dc2626" }}>{err}</p>}
        <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 12, boxSizing: "border-box" }} />
        <input type="password" placeholder="New password (min 10 chars)" value={next} onChange={(e) => setNext(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e4e9f2", marginBottom: 16, boxSizing: "border-box" }} />
        <button
          onClick={async () => {
            setErr(null); setMsg(null);
            try {
              await api.post("/api/auth/change-password", { currentPassword: current, newPassword: next });
              setMsg("Password changed.");
              const r = await api.get("/api/auth/me");
              onDone(r.data.user);
            } catch (e: any) {
              setErr(
  e.response?.data?.message ||
  e.response?.data?.error ||
  e.message ||
  "Failed to change password."
);
            }
          }}
          disabled={next.length < 10}
          style={{ width: "100%", padding: 13, background: "#5b2d8e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: next.length < 10 ? "not-allowed" : "pointer", opacity: next.length < 10 ? 0.6 : 1 }}
        >Update password</button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6f7fb" }}>
      {children}
    </div>
  );
}
