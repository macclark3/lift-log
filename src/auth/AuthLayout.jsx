import React from "react";

// Shared chrome for every unauthenticated screen: gradient background,
// centered Spotter wordmark, content slot for the form. Keeps the visual
// language identical to the main app (navy/white, Fraunces, mono labels).
export function AuthLayout({ subtitle, children }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5 py-10 pt-safe pb-safe"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        background: "linear-gradient(180deg, #fafbfd 0%, #f1f4f9 100%)",
        color: "var(--navy-900)",
      }}
    >
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium">Welcome to</div>
          <h1 className="serif text-5xl tracking-tight mt-1" style={{ fontWeight: 500, color: "var(--navy-900)" }}>
            Spotter
          </h1>
          {subtitle && <p className="mt-3 text-sm text-navy-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

// Small shared label/control wrapper, mirrors the Field component used in
// the main app's edit views.
export function AuthField({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">{label}</div>
      {children}
    </div>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
      style={{ background: "rgba(220, 38, 38, 0.05)", borderColor: "rgba(220, 38, 38, 0.2)", color: "#dc2626" }}
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }) {
  if (!message) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
      style={{ background: "rgba(31, 138, 95, 0.06)", borderColor: "rgba(31, 138, 95, 0.25)", color: "var(--success)" }}
    >
      {message}
    </div>
  );
}

export function AuthLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(180deg, #fafbfd 0%, #f1f4f9 100%)" }}
    >
      <div className="serif text-3xl tracking-tight" style={{ fontWeight: 500, color: "var(--navy-900)" }}>
        Spotter
      </div>
      <div
        className="mt-5 w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--navy-200)", borderTopColor: "var(--navy-900)" }}
      />
    </div>
  );
}
