import { useEffect, useState } from "react";
import { Header, Footer } from "./ui";
import { Landing } from "./screens/Landing";
import { ReportForm } from "./screens/ReportForm";
import { ReportReceived } from "./screens/ReportReceived";
import { TrackReport } from "./screens/TrackReport";
import { GetSupport, Resources } from "./screens/Support";
import { getAccessToken, setAccessToken, api } from "./lib/api";

function currentPath(): string {
  const h = location.hash.replace(/^#\/?/, "");
  return h.split("?")[0] || "home";
}

export default function App() {
  const [page, setPage] = useState(currentPath());
  const [done, setDone] = useState<{ ref: string; tracking: string | null } | null>(null);

  useEffect(() => {
    const onHash = () => setPage(currentPath());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Try to restore session silently
    if (!getAccessToken()) {
      api.post("/api/auth/refresh").then((r) => setAccessToken(r.data.accessToken)).catch(() => { });
    }
  }, []);

  function navigate(p: string) {
    if (p !== "received") setDone(null);
    location.hash = `#/${p}`;
    setPage(p);
    window.scrollTo(0, 0);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <Header onNavigate={navigate} current={page} />
      <main style={{ flex: 1 }}>
        {page === "home" && <Landing onNavigate={navigate} />}
        {page === "report" && (
          done
            ? <ReportReceived reference={done.ref} trackingCode={done.tracking} onNavigate={navigate} />
            : <ReportForm onDone={(ref, tracking) => { setDone({ ref, tracking }); navigate("received"); }} />
        )}
        {page === "track" && <TrackReport />}
        {page === "support" && <GetSupport />}
        {page === "resources" && <Resources />}
      </main>
      <Footer />
    </div>
  );
}
