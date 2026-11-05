// Report a Crime — multi-step form with anonymous/confidential choice,
// real MediaRecorder voice capture, camera capture, file evidence.
import { useRef, useState } from "react";
import { api, friendlyError } from "../lib/api";
import { C, FONT } from "../theme";
import { Button, Card, Field, Notice } from "../ui";

const CATEGORIES = [
  "Theft", "Assault", "Domestic violence", "Child abuse", "Sexual violence",
  "Fraud / scam", "Cybercrime", "Kidnapping", "Robbery", "Corruption / bribery",
  "Human trafficking", "Drug related", "Property damage", "Missing person", "Other",
];
const REGIONS = ["Greater Accra", "Ashanti", "Western", "Central", "Volta", "Eastern", "Northern", "Upper East", "Upper West", "Bono", "Bono East", "Ahafo", "Savannah", "North East", "Oti", "Western North"];

interface EvidenceItem { file: File; kind: string; preview?: string }

export function ReportForm({ onDone }: { onDone: (ref: string, tracking: string | null) => void }) {
  const [step, setStep] = useState(1);
  const [identity, setIdentity] = useState<"anonymous" | "confidential" | null>(null);
  const [form, setForm] = useState({
    category: "", description: "", incidentDate: "", incidentTime: "",
    region: "", town: "", landmark: "", ongoing: false, urgency: "normal",
    perpetratorKnown: false, perpetratorName: "", perpetratorDesc: "", witnessInfo: "",
    contactName: "", contactPhone: "", contactEmail: "", safeContactMethod: "in_app",
  });
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // ---------- Voice recording (real MediaRecorder) ----------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const dur = recSeconds;
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        setEvidence((ev) => [...ev, { file, kind: "audio" }]);
        setRecording(false);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      const iv = setInterval(() => setRecSeconds((s) => {
        if (s >= 300) { mr.stop(); clearInterval(iv); return s; }
        return s + 1;
      }), 1000);
    } catch {
      setErr("Microphone permission was denied or is unavailable. You can attach an existing audio file instead.");
    }
  }
  function stopRecording() { mediaRef.current?.stop(); }

  // ---------- Camera capture ----------
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      cameraStreamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch {
      setErr("Camera unavailable. You can attach photos from your gallery instead.");
    }
  }
  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraOn(false);
  }
  function snapPhoto() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      setEvidence((ev) => [...ev, { file, kind: "photo", preview: URL.createObjectURL(blob) }]);
      closeCamera();
    }, "image/jpeg", 0.9);
  }

  function addFiles(list: FileList | null, kind: string) {
    if (!list) return;
    const items: EvidenceItem[] = [];
    for (const f of Array.from(list)) {
      items.push({ file: f, kind, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
    }
    setEvidence((ev) => [...ev, ...items]);
  }
  function removeEvidence(i: number) { setEvidence((ev) => ev.filter((_, x) => x !== i)); }

  // ---------- Submit ----------
  async function submit() {
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("category", form.category);
      fd.append("description", form.description);
      if (form.incidentDate) fd.append("incidentDate", form.incidentDate);
      if (form.incidentTime) fd.append("incidentTime", form.incidentTime);
      fd.append("region", form.region);
      if (form.town) fd.append("town", form.town);
      if (form.landmark) fd.append("landmark", form.landmark);
      fd.append("ongoing", String(form.ongoing));
      fd.append("urgency", form.urgency);
      fd.append("perpetratorKnown", String(form.perpetratorKnown));
      if (form.perpetratorName) fd.append("perpetratorName", form.perpetratorName);
      if (form.perpetratorDesc) fd.append("perpetratorDesc", form.perpetratorDesc);
      if (form.witnessInfo) fd.append("witnessInfo", form.witnessInfo);
      fd.append("isAnonymous", String(identity === "anonymous"));
      if (identity === "confidential") {
        if (form.contactName) fd.append("contactName", form.contactName);
        if (form.contactPhone) fd.append("contactPhone", form.contactPhone);
        if (form.contactEmail) fd.append("contactEmail", form.contactEmail);
      }
      for (const ev of evidence.slice(0, 8)) fd.append("evidence", ev.file, ev.file.name);

      const res = await api.post("/api/reports", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onDone(res.data.reference, res.data.trackingCode);
    } catch (e) {
      setErr(await friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const canStep2 = form.category && form.description.length >= 20;
  const canSubmit = !!identity;

  const stepTitles = ["The incident", "Evidence", "Identity & submit"];

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: "0 20px" }}>
      <h1 style={{ color: C.purple, fontSize: 26, marginBottom: 4 }}>Report a Crime</h1>
      <p style={{ color: C.muted, marginBottom: 22 }}>You do not need to know the legal classification. Describe what happened in your own words.</p>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {stepTitles.map((t, i) => (
          <div key={t} style={{ flex: 1 }}>
            <div style={{ height: 5, borderRadius: 99, background: step > i ? C.teal : C.line }} />
            <div style={{ fontSize: 11.5, marginTop: 6, fontWeight: 600, color: step > i ? C.teal : C.muted }}>{t}</div>
          </div>
        ))}
      </div>

      {err && <Notice kind="error">{err}</Notice>}

      {/* ---------- STEP 1: incident ---------- */}
      {step === 1 && (
        <Card>
          <Field label="Type of incident" required value={form.category} onChange={(v) => set("category", v)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <Field label="What happened?" required rows={6} value={form.description} onChange={(v) => set("description", v)} placeholder="Describe what happened, who was involved, and anything else that helps us understand the situation…" hint={`${form.description.length}/20 characters minimum`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Date (approximate is fine)" type="date" value={form.incidentDate} onChange={(v) => set("incidentDate", v)} />
            <Field label="Time (approximate)" type="time" value={form.incidentTime} onChange={(v) => set("incidentTime", v)} />
          </div>
          <Field label="Region" required value={form.region} onChange={(v) => set("region", v)} options={REGIONS.map((r) => ({ value: r, label: r }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Town / City" value={form.town} onChange={(v) => set("town", v)} placeholder="e.g. Madina" />
            <Field label="Landmark" value={form.landmark} onChange={(v) => set("landmark", v)} placeholder="e.g. near the lorry station" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.ongoing} onChange={(e) => set("ongoing", e.target.checked)} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>This is happening right now / is ongoing</span>
          </label>
          <Field label="How urgent is it?" required value={form.urgency} onChange={(v) => set("urgency", v)} options={[
            { value: "low", label: "Low — it happened a while ago, no immediate risk" },
            { value: "normal", label: "Normal — needs attention soon" },
            { value: "urgent", label: "Urgent — someone may be at risk now" },
          ]} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={form.perpetratorKnown} onChange={(e) => set("perpetratorKnown", e.target.checked)} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>I know who did this (optional)</span>
          </label>
          {form.perpetratorKnown && (
            <>
              <Field label="Name (if known)" value={form.perpetratorName} onChange={(v) => set("perpetratorName", v)} />
              <Field label="Description" rows={2} value={form.perpetratorDesc} onChange={(v) => set("perpetratorDesc", v)} placeholder="Appearance, where they might be found…" />
            </>
          )}
          <Field label="Witness information (optional)" rows={2} value={form.witnessInfo} onChange={(v) => set("witnessInfo", v)} placeholder="Names or contact of witnesses, if any" />
          <Button full disabled={!canStep2} onClick={() => setStep(2)}>Continue to Evidence</Button>
          {!canStep2 && <p style={{ color: C.muted, fontSize: 12.5, textAlign: "center", marginTop: 10 }}>Choose a category and write at least 20 characters to continue.</p>}
        </Card>
      )}

      {/* ---------- STEP 2: evidence ---------- */}
      {step === 2 && (
        <Card>
          <h3 style={{ marginTop: 0, color: C.ink }}>Add evidence (all optional)</h3>
          <p style={{ color: C.muted, fontSize: 13.5, marginTop: 0 }}>Photos, video clips and voice notes help reviewers understand the situation faster. Max 8 files.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
            <label style={uploadTileStyle}>
              📷 Take photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files, "photo")} />
            </label>
            <label style={uploadTileStyle}>
              🖼️ From gallery<input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files, "photo")} />
            </label>
            <label style={uploadTileStyle}>
              🎥 Video<input type="file" accept="video/*" hidden onChange={(e) => addFiles(e.target.files, "video")} />
            </label>
            <button style={{ ...uploadTileStyle, border: recording ? `2px solid ${C.red}` : undefined }} onClick={recording ? stopRecording : startRecording}>
              {recording ? `⏹ Stop (${recSeconds}s)` : "🎤 Record voice"}
            </button>
            <label style={uploadTileStyle}>
              🎵 Audio file<input type="file" accept="audio/*" hidden onChange={(e) => addFiles(e.target.files, "audio")} />
            </label>
            <label style={uploadTileStyle}>
              📄 Document<input type="file" accept="application/pdf" hidden onChange={(e) => addFiles(e.target.files, "document")} />
            </label>
          </div>

          {cameraOn && (
            <div style={{ marginBottom: 18 }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 12, maxHeight: 340, background: "#000" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Button onClick={snapPhoto}>Capture</Button>
                <Button kind="ghost" onClick={closeCamera}>Cancel</Button>
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: C.ink, marginBottom: 10 }}>Attached ({evidence.length}/8)</h4>
              {evidence.map((ev, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                  {ev.preview
                    ? <img src={ev.preview} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 8 }} />
                    : <span style={{ fontSize: 26 }}>{ev.kind === "audio" ? "🎤" : ev.kind === "video" ? "🎥" : "📄"}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.file.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{(ev.file.size / 1024 / 1024).toFixed(2)} MB · {ev.kind}</div>
                  </div>
                  <button onClick={() => removeEvidence(i)} style={removeBtnStyle}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <Button kind="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button full onClick={() => setStep(3)}>Continue</Button>
          </div>
        </Card>
      )}

      {/* ---------- STEP 3: identity & submit ---------- */}
      {step === 3 && (
        <Card>
          <h3 style={{ marginTop: 0, color: C.ink }}>How would you like to report?</h3>
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            <label style={choiceStyle(identity === "anonymous")}>
              <input type="radio" name="identity" checked={identity === "anonymous"} onChange={() => setIdentity("anonymous")} />
              <div>
                <strong>Report anonymously</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
                  We do not ask for your name or contact details. You will receive a tracking code — keep it safe,
                  it is the only way to follow up. Note: absolute anonymity cannot be guaranteed (network or device records may exist).
                </p>
              </div>
            </label>
            <label style={choiceStyle(identity === "confidential")}>
              <input type="radio" name="identity" checked={identity === "confidential"} onChange={() => setIdentity("confidential")} />
              <div>
                <strong>Report confidentially</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>
                  Share contact details so authorised staff can follow up with you directly. Your identity is
                  restricted to authorised reviewers and is never shared publicly.
                </p>
              </div>
            </label>
          </div>

          {identity === "confidential" && (
            <>
              <Field label="Your name" value={form.contactName} onChange={(v) => set("contactName", v)} />
              <Field label="Phone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="024XXXXXXX" />
              <Field label="Email" type="email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} />
              <Field label="Preferred safe contact method" value={form.safeContactMethod} onChange={(v) => set("safeContactMethod", v)} options={[
                { value: "in_app", label: "Through this platform (tracking page)" },
                { value: "phone", label: "Phone call" },
                { value: "email", label: "Email" },
                { value: "none", label: "Do not contact me — I will check the tracking page" },
              ]} />
            </>
          )}

          <div style={{ background: C.amberBg, borderRadius: 12, padding: 14, fontSize: 13, color: "#7a5c00", marginBottom: 18 }}>
            ⚠️ REPORTA reports are reviewed by authorised personnel. This platform does not replace emergency services —
            in immediate danger call <strong>191</strong>.
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Button kind="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button full disabled={!canSubmit || busy} onClick={submit}>{busy ? "Submitting securely…" : "Submit report"}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

const uploadTileStyle: React.CSSProperties = {
  border: `1.5px dashed ${C.line}`, borderRadius: 14, padding: "18px 10px",
  textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 600,
  color: C.ink, background: "#fafbfe", fontFamily: FONT,
};

const removeBtnStyle: React.CSSProperties = {
  background: C.redBg, color: C.red, border: "none", borderRadius: 8,
  padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12.5, fontFamily: FONT,
};

function choiceStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", gap: 12, padding: 16, borderRadius: 14, cursor: "pointer",
    border: `2px solid ${active ? C.teal : C.line}`, background: active ? "#f0fbfa" : "#fff",
    alignItems: "flex-start",
  };
}
