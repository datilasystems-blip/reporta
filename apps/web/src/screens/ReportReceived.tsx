// Report received — confirmation with reference + tracking code
import { useState } from "react";
import { C } from "../theme";
import { Button, Card } from "../ui";
import { LogoShield } from "../ui";

export function ReportReceived({ reference, trackingCode, onNavigate }: {
  reference: string;
  trackingCode: string | null;
  onNavigate: (p: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyTracking() {
    if (!trackingCode) return;
    await navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 560, margin: "48px auto", padding: "0 20px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <LogoShield size={72} />
      </div>
      <h1 style={{ color: C.green, fontSize: 28, margin: "0 0 8px" }}>Report received ✓</h1>
      <p style={{ color: C.muted, marginBottom: 28 }}>
        Your report has been securely stored and queued for review by authorised personnel.
        This does not mean the report has been reviewed yet.
      </p>

      <Card style={{ textAlign: "left", marginBottom: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Reference number</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.purple, letterSpacing: ".02em" }}>{reference}</div>
        </div>

        {trackingCode && (
          <div style={{ background: C.amberBg, borderRadius: 12, padding: 16, border: `1px solid #f0dfae` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7a5c00", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
              🔐 Your tracking code — shown only once
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <code style={{ fontSize: 18, fontWeight: 700, color: C.ink, flex: 1, wordBreak: "break-all" }}>{trackingCode}</code>
              <Button kind="ghost" onClick={copyTracking}>{copied ? "Copied ✓" : "Copy"}</Button>
            </div>
            <p style={{ fontSize: 12.5, color: "#7a5c00", margin: "10px 0 0" }}>
              You reported anonymously. Save this code now — without it you cannot view this report again.
            </p>
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gap: 12 }}>
        <Button full onClick={() => onNavigate("track")}>Track this report</Button>
        <Button full kind="ghost" onClick={() => onNavigate("home")}>Back to home</Button>
      </div>

      <div style={{ marginTop: 26, background: C.redBg, borderRadius: 12, padding: 14, fontSize: 13, color: C.red }}>
        In immediate danger? Call <strong>191</strong> (Police) or <strong>112</strong> (Ambulance) now.
      </div>
    </div>
  );
}
