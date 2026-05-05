import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthLayout, AuthField, AuthError, AuthSuccess } from "./AuthLayout";

export function ForgotPasswordScreen({ onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout subtitle="Reset your password">
      <form
        onSubmit={handleSubmit}
        className="surface border border-soft card-shadow rounded-2xl p-6 space-y-4"
      >
        {!sent && (
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
        )}
        {sent && (
          <AuthSuccess message="If an account exists for that email, we've sent reset instructions. Check your inbox." />
        )}
        <AuthError message={error} />
        {!sent ? (
          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
            style={{ background: "var(--navy-900)" }}
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full text-white py-3.5 rounded-xl font-semibold text-sm transition"
            style={{ background: "var(--navy-900)" }}
          >
            Back to sign in
          </button>
        )}
        {!sent && (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full text-sm text-navy-500 hover:text-navy-900 transition"
          >
            Back to sign in
          </button>
        )}
      </form>
    </AuthLayout>
  );
}
