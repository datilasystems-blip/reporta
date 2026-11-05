// Support & resources — real, actionable Ghana-specific guidance
import { C } from "../theme";
import { Card } from "../ui";

export function GetSupport() {
  const hotlines = [
    { name: "Ghana Police Service", num: "191", desc: "Emergency police response, 24/7" },
    { name: "Ambulance / Medical", num: "112", desc: "National emergency medical line" },
    { name: "Fire Service", num: "192", desc: "Fire and rescue emergencies" },
    { name: "DOVVSU", num: "0800-111-222", desc: "Domestic Violence & Victim Support Unit — free toll-free" },
    { name: "Child Helpline", num: "0800-900-900", desc: "Support for children in crisis" },
    { name: "Mental Health Authority", num: "0800-678-678", desc: "Counselling and crisis support" },
  ];
  const steps = [
    { t: "Get to a safe place", d: "If you are in danger, move somewhere safe first. Your safety matters more than preserving evidence." },
    { t: "Call for immediate help", d: "For emergencies use the hotlines on this page. REPORTA is not monitored 24/7 and cannot dispatch emergency response." },
    { t: "Report to REPORTA", d: "When you are safe, submit a report with as much detail as you can. Anonymous reporting is available." },
    { t: "Keep your reference", d: "Save the reference number and tracking code so you can follow up securely." },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 20px" }}>
      <h1 style={{ color: C.purple, fontSize: 26, marginBottom: 6 }}>Get support</h1>
      <p style={{ color: C.muted, marginBottom: 26 }}>
        If you or someone else is in immediate danger, call an emergency line now — do not wait for an online report.
      </p>

      <div style={{ background: C.redBg, border: `1px solid #f5c6c6`, borderRadius: 14, padding: 20, marginBottom: 30 }}>
        <strong style={{ color: C.red }}>⚠️ REPORTA is not an emergency service.</strong>
        <span style={{ color: "#7a1f1f" }}> Reports are reviewed during working arrangements of authorised staff. For immediate threats always call 191 or 112.</span>
      </div>

      <h2 style={{ color: C.purple, fontSize: 20, marginBottom: 14 }}>Emergency &amp; support hotlines</h2>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 36 }}>
        {hotlines.map((h) => (
          <Card key={h.name}>
            <div style={{ fontWeight: 800, color: C.ink, fontSize: 15 }}>{h.name}</div>
            <a href={`tel:${h.num}`} style={{ fontSize: 24, fontWeight: 900, color: C.teal, textDecoration: "none", display: "block", margin: "6px 0" }}>{h.num}</a>
            <div style={{ fontSize: 13, color: C.muted }}>{h.desc}</div>
          </Card>
        ))}
      </div>

      <h2 style={{ color: C.purple, fontSize: 20, marginBottom: 14 }}>What to do after an incident</h2>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 36 }}>
        {steps.map((s, i) => (
          <Card key={s.t}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.purple, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{i + 1}</div>
            <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>{s.t}</div>
            <p style={{ margin: 0, fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>{s.d}</p>
          </Card>
        ))}
      </div>

      <h2 style={{ color: C.purple, fontSize: 20, marginBottom: 14 }}>Your privacy</h2>
      <Card>
        <ul style={{ margin: 0, paddingLeft: 20, color: C.muted, fontSize: 14, lineHeight: 1.9 }}>
          <li>You may report <strong>anonymously</strong> — no name or contact details are required.</li>
          <li>Confidential reports are visible only to authorised reviewers.</li>
          <li>Evidence (photos, video, audio) is stored in a private vault, never published.</li>
          <li>We do not publicly publish accusations, identities of alleged perpetrators, or reporter identities.</li>
          <li>Anonymous reporters receive a tracking code — it is the only way to follow up, so keep it safe.</li>
        </ul>
      </Card>
    </div>
  );
}

export function Resources() {
  const items = [
    { t: "How REPORTA works", d: "Understand what happens after you submit — from intake queue to officer assignment and case closure." },
    { t: "Anonymous vs confidential reporting", d: "Anonymous: no identity collected, follow-up only via tracking code. Confidential: authorised staff can contact you directly with your consent." },
    { t: "Evidence guidelines", d: "Clear photos, steady video, and short voice notes are most useful. Do not put yourself in danger to collect evidence." },
    { t: "Case statuses explained", d: "Received → Under review → Assigned → Investigation → Closed. Each stage appears on your tracking timeline." },
    { t: "Safety planning", d: "If you face ongoing harm, DOVVSU and the Child Helpline can help you make a safety plan." },
    { t: "For officers & administrators", d: "Authorised staff sign in at the admin or officer portals — links are provided by your office." },
  ];
  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 20px" }}>
      <h1 style={{ color: C.purple, fontSize: 26, marginBottom: 6 }}>Resources</h1>
      <p style={{ color: C.muted, marginBottom: 24 }}>Guidance on reporting, safety, and how the platform handles your information.</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {items.map((i) => (
          <Card key={i.t}>
            <div style={{ fontWeight: 800, color: C.ink, fontSize: 15.5, marginBottom: 8 }}>{i.t}</div>
            <p style={{ margin: 0, fontSize: 13.5, color: C.muted, lineHeight: 1.65 }}>{i.d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
