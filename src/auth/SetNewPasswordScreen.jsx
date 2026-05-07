import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthLayout, AuthField, AuthError, AuthSuccess } from "./AuthLayout";

// Shown when the user lands back in the app via a password-reset email link.
// Supabase fires PASSWORD_RECOVERY when the recovery token is parsed; we
// gate the rest of the app on that flag and offer this screen until they
// finish updating the password.
export function SetNewPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    // USER_UPDATED fires globally and clears isPasswordRecovery; show a
    // brief confirmation while the auth state propagates.
    setDone(true);
  };

  return (
    <AuthLayout subtitle="Set a new password">
      <form
        onSubmit={handleSubmit}
        className="surface border border-soft card-shadow rounded-2xl p-6 space-y-4"
      >
        {!done ? (
          <>
            <AuthField label="New password">
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
              />
            </AuthField>
            <AuthField label="Confirm new password">
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
              {submitting ? "Updating…" : "Update password"}
            </button>
          </>
        ) : (
          <AuthSuccess message="Password updated. Taking you in…" />
        )}
      </form>
    </AuthLayout>
  );
}
