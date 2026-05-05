import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthLayout, AuthField, AuthError } from "./AuthLayout";

// Minimum age for account creation. Below this we refuse client-side; the
// Supabase trigger may also enforce this server-side eventually.
const MIN_AGE = 13;

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDelta = today.getMonth() - d.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function SignupScreen({ onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }
    const age = ageFromDob(dob);
    if (age === null || age < MIN_AGE) {
      setError(`You must be at least ${MIN_AGE} years old to create an account.`);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { date_of_birth: dob } },
    });
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    // If Supabase requires email confirmation, no session will be returned
    // here and the user needs to click the link in their inbox before they
    // can sign in. Surface that state explicitly rather than silently doing
    // nothing.
    if (!data.session) {
      setNeedsConfirmation(true);
    }
    // If a session WAS returned, the global auth subscription handles the
    // route swap.
  };

  if (needsConfirmation) {
    return (
      <AuthLayout subtitle="Almost there">
        <div className="surface border border-soft card-shadow rounded-2xl p-6 space-y-4">
          <div className="text-sm text-navy-700 leading-relaxed">
            We sent a confirmation link to <span className="mono font-semibold">{email}</span>. Click it to finish creating your account, then come back here to sign in.
          </div>
          <button
            onClick={onSwitchToLogin}
            className="w-full text-white py-3.5 rounded-xl font-semibold text-sm transition"
            style={{ background: "var(--navy-900)" }}
          >
            Back to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Create your account">
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
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </AuthField>
        <AuthField label="Confirm password">
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </AuthField>
        <AuthField label="Date of birth">
          <input
            type="date"
            required
            value={dob}
            onChange={e => setDob(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </AuthField>
        <AuthError message={error} />
        <button
          type="submit"
          disabled={submitting}
          className="w-full text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
          style={{ background: "var(--navy-900)" }}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <div className="text-center mt-6 text-sm text-navy-600">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="font-semibold text-navy-900 underline-offset-2 hover:underline"
        >
          Sign in
        </button>
      </div>
    </AuthLayout>
  );
}
