import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthLayout, AuthField, AuthError } from "./AuthLayout";

export function LoginScreen({ onSwitchToSignup, onSwitchToForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Flash message read once on mount: set by the account-delete flow
  // before signing the user out. Stays visible until the screen
  // unmounts (sign-in success or switch to signup). The sessionStorage
  // key clears on first read so re-mounts don't replay it.
  const [accountDeletedFlash] = useState(() => {
    try {
      if (sessionStorage.getItem("flash:accountDeleted") === "1") {
        sessionStorage.removeItem("flash:accountDeleted");
        return true;
      }
    } catch {}
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(error.message);
    // Success: the global auth subscription picks up the session and the app
    // shell swaps to the authenticated view.
  };

  return (
    <AuthLayout subtitle="Let's get back to work.">
      {accountDeletedFlash && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-xs leading-relaxed border"
          style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success)" }}
          role="status"
        >
          Account deleted. You can sign in with another account or create a new one below.
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="surface border border-soft card-shadow rounded-2xl p-6 space-y-4"
      >
        <AuthField label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </AuthField>
        <AuthError message={error} />
        <button
          type="submit"
          disabled={submitting}
          className="w-full text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
          style={{ background: "var(--primary)" }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <button
          type="button"
          onClick={onSwitchToForgot}
          className="w-full text-sm text-navy-500 hover:text-navy-900 transition"
        >
          Forgot password?
        </button>
      </form>
      <div className="text-center mt-6 text-sm text-navy-600">
        Don't have an account?{" "}
        <button
          onClick={onSwitchToSignup}
          className="font-semibold text-navy-900 underline-offset-2 hover:underline"
        >
          Create one
        </button>
      </div>
    </AuthLayout>
  );
}
