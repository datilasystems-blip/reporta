// Shared UI components matching the REPORTA mockup
import type { CSSProperties, ReactNode } from "react";
import { C, FONT, BRAND, statusStyle } from "./theme";

export function LogoShield({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="REPORTA shield logo">
      <path d="M32 4 L56 12 V32 C56 46 46 56 32 60 C18 56 8 46 8 32 V12 Z" fill={C.purple} />
      <path d="M32 4 L56 12 V32 C56 46 46 56 32 60 Z" fill={C.purpleDark} opacity="0.35" />
      {/* three figures (family) in white/teal/gold */}
      <circle cx="32" cy="22" r="5.5" fill="#fff" />
      <path d="M23 40 C23 32 41 32 41 40 V44 H23 Z" fill="#fff" />
      <circle cx="20" cy="26" r="4" fill={C.teal} />
      <path d="M13 41 C13 34.5 27 34.5 27 41 V44 H13 Z" fill={C.teal} />
      <circle cx="44" cy="26" r="4" fill={C.gold} />
      <path d="M37 41 C37 34.5 51 34.5 51 41 V44 H37 Z" fill={C.gold} />
    </svg>
  );
}

export function LogoWordmark({ dark = false, size = 22 }: { dark?: boolean; size?: number }) {
  return (
    <span style={{ fontWeight: 900, letterSpacing: "0.04em", fontSize: size, color: dark ? C.ink : "#fff" }}>
      REPORT<span style={{ color: C.gold }}>A</span>
    </span>
  );
}

export function Button({
  children, onClick, kind = "primary", full, disabled, type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "teal";
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles: CSSProperties = {
    primary: { background: C.purple, color: "#fff" },
    teal: { background: C.teal, color: "#fff" },
    ghost: { background: "#fff", color: C.ink, border: `1px solid ${C.line}` },
    danger: { background: C.red, color: "#fff" },
  }[kind];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        border: styles.border ?? "none",
        borderRadius: 12,
        padding: "13px 26px",
        fontWeight: 700,
        fontSize: 15,
        fontFamily: FONT,
        width: full ? "100%" : undefined,
        transition: "transform .1s ease, opacity .2s ease",
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: 22,
      border: `1px solid ${C.line}`, boxShadow: "0 2px 12px rgba(43,21,68,.06)",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Field({
  label, value, onChange, type = "text", placeholder, required, hint, options, rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  rows?: number;
}) {
  const labelStyle: CSSProperties = { fontWeight: 700, fontSize: 13, color: C.ink, marginBottom: 6, display: "block" };
  const inputStyle: CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`,
    fontSize: 15, fontFamily: FONT, outline: "none", background: "#fff", color: C.ink,
    boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: C.red }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : rows ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle}
        />
      )}
      {hint && <p style={{ fontSize: 12, color: C.muted, margin: "5px 0 0" }}>{hint}</p>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "success" | "error" | "info"; children: ReactNode }) {
  const map = {
    success: { bg: C.greenBg, fg: C.green },
    error: { bg: C.redBg, fg: C.red },
    info: { bg: "#e8f0fe", fg: "#1a56cc" },
  }[kind];
  return (
    <div style={{ background: map.bg, color: map.fg, borderRadius: 12, padding: "12px 16px", fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
      {children}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { bg, fg, label } = statusStyle(status) as any;
  return (
    <span style={{ background: bg, color: fg, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  );
}

export function Header({ onNavigate, current }: { onNavigate: (p: string) => void; current: string }) {
  const links = [
    { key: "home", label: "Home" },
    { key: "report", label: "Report a Crime" },
    { key: "track", label: "Track Report" },
    { key: "support", label: "Get Support" },
    { key: "resources", label: "Resources" },
  ];
  return (
    <header style={{ background: C.purpleDeep, position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }} onClick={() => onNavigate("home")}>
          <LogoShield size={38} />
          <div>
            <LogoWordmark />
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 10.5 }}>{BRAND.tagline}</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {links.map((l) => (
            <button
              key={l.key}
              onClick={() => onNavigate(l.key)}
              style={{
                background: current === l.key ? "rgba(255,255,255,.16)" : "transparent",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 13px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ background: C.purpleDeep, color: "rgba(255,255,255,.75)", marginTop: 48 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 20px", display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <LogoShield size={32} />
            <LogoWordmark size={18} />
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            REPORTA is a secure crime-reporting platform. Reports are reviewed by authorised personnel.
            This platform is not monitored 24/7. In an emergency, call the Ghana Police Service on <strong style={{ color: C.gold }}>191</strong>
            {" "}or the Domestic Violence and Victim Support Unit (DOVVSU) on <strong style={{ color: C.gold }}>0800-111-222</strong>.
          </p>
        </div>
        <div>
          <h4 style={{ color: C.gold, fontSize: 13, marginBottom: 10, letterSpacing: ".05em" }}>EMERGENCY CONTACTS</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, lineHeight: 2 }}>
            <li>Police: 191</li>
            <li>Ambulance: 112</li>
            <li>Fire Service: 192</li>
            <li>DOVVSU: 0800-111-222</li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: C.gold, fontSize: 13, marginBottom: 10, letterSpacing: ".05em" }}>ABOUT</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, lineHeight: 2 }}>
            <li>Privacy &amp; confidentiality</li>
            <li>How reporting works</li>
            <li>Report tracking</li>
            <li>Support resources</li>
          </ul>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", textAlign: "center", padding: "14px", fontSize: 12, color: "rgba(255,255,255,.45)" }}>
        REPORTA by Datila for Ghana · REPORTA does not imply government endorsement unless formally authorised.
      </div>
    </footer>
  );
}
