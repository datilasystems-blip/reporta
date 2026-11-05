// Landing screen — purple hero, shield, tagline, three feature cards, emergency notice
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { C, FONT, BRAND } from "../theme";
import { LogoShield, Button, Card } from "../ui";

export function Landing({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [stats, setStats] = useState<{ totalReports: number; resolvedThisMonth: number; avgResolutionDays: number | null } | null>(null);

  useEffect(() => {
    api.get("/api/public/stats").then((r) => setStats(r.data)).catch(() => { });
  }, []);

  return (
    <div>
      {/* HERO */}
      <section style={{
        background: `linear-gradient(135deg, ${C.purpleDeep} 0%, ${C.purple} 55%, #7a3fb8 100%)`,
        color: "#fff", textAlign: "center", padding: "72px 20px 84px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", right: -120, top: -120, width: 340, height: 340, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(242,183,34,.28), transparent 70%)",
        }} />
        <LogoShield size={110} />
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", margin: "16px 0 10px", lineHeight: 1.15 }}>
          Speak up. <span style={{ color: C.gold }}>Report safely.</span> Get support.
        </h1>
        <p style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto 26px", color: "#e6dcf5" }}>
          REPORTA lets anyone in Ghana report a crime securely — with photos, video and voice evidence —
          and routes it to authorised personnel for review and appropriate action.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Button onClick={() => onNavigate("report")} kind="primary" >Report a Crime</Button>
          <Button onClick={() => onNavigate("track")} kind="ghost">Track My Report</Button>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 32, justifyContent: "center", marginTop: 34, flexWrap: "wrap" }}>
            {[
              { v: stats.totalReports, l: "Reports received" },
              { v: stats.resolvedThisMonth, l: "Resolved this month" },
              ...(stats.avgResolutionDays != null ? [{ v: stats.avgResolutionDays, l: "Avg. days to resolve" }] : []),
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontSize: 30, fontWeight: 900, color: C.gold }}>{s.v}</div>
                <div style={{ fontSize: 12, color: "#d8cdeb", textTransform: "uppercase", letterSpacing: ".06em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FEATURE CARDS */}
      <section style={{ maxWidth: 1180, margin: "48px auto 0", padding: "0 20px" }}>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {[
            { icon: "📋", bg: "#f3ead7", fg: C.purple, title: "Report a crime", body: "Submit a report in minutes — with or without your identity. Add photos, video, and voice recordings as evidence." },
            { icon: "🔒", bg: "#e0f2f1", fg: C.tealDark, title: "Safe & confidential", body: "Choose anonymous or confidential reporting. Evidence is stored securely and only authorised staff can access it." },
            { icon: "🔎", bg: C.amberBg, fg: C.goldDark, title: "Track your report", body: "Follow your case from submission to closure with your reference number and tracking code." },
          ].map((f) => (
            <Card key={f.title}>
              <div style={{ fontSize: 30, width: 52, height: 52, lineHeight: "52px", textAlign: "center", borderRadius: "50%", background: f.bg, color: f.fg, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ color: C.purple, margin: "0 0 8px", fontSize: 17 }}>{f.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{f.body}</p>
            </Card>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <h2 style={{ color: C.purple, fontSize: 24, margin: "52px 0 6px" }}>How reporting works</h2>
        <p style={{ color: C.muted, margin: "0 0 24px" }}>Four simple steps — no legal knowledge needed.</p>
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 40 }}>
          {[
            { n: 1, t: "Tell us what happened", d: "Pick a category and describe the incident in your own words." },
            { n: 2, t: "Add evidence (optional)", d: "Attach photos, video or a voice recording if you have them." },
            { n: 3, t: "Get your reference", d: "You receive a reference number and tracking code immediately." },
            { n: 4, t: "Follow up safely", d: "Authorised staff review and act. Track progress anytime." },
          ].map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.purple, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 700, color: C.ink, fontSize: 14.5 }}>{s.t}</div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* EMERGENCY NOTICE */}
        <div style={{ background: C.purpleDeep, color: "#fff", borderRadius: 16, padding: "32px 28px", textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>In immediate danger?</h2>
          <p style={{ color: "#d8cdeb", margin: "0 0 20px" }}>
            REPORTA is not monitored continuously. If someone is in immediate danger, do not wait — call for help now.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {[["Police", "191"], ["Ambulance", "112"], ["DOVVSU", "0800-111-222"]].map(([l, n]) => (
              <a key={l} href={`tel:${n}`} style={{ background: C.gold, color: C.purpleDeep, borderRadius: 999, padding: "12px 26px", fontWeight: 800, textDecoration: "none" }}>
                {l}: {n}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
