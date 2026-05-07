import React, { useState } from "react";
import { AuthLayout, AuthError } from "./AuthLayout";
import { focusToEnd } from "../lib/inputs";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const EXPERIENCE_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const GOAL_OPTIONS = ["Strength", "Hypertrophy", "Endurance", "Weight loss", "General fitness"];

// Shown once for fresh accounts to capture optional profile context. None
// of the fields are required to proceed — Skip and Continue both flip
// profile.onboarded to true so the screen never appears again. The form
// starts blank by design: this is a brand-new-account flow, and the
// caller has already wiped per-user localStorage to a clean state. Only
// Continue writes the entered values to profile; Skip leaves profile
// untouched.
export function OnboardingScreen({ onComplete, saveError }) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  // Imperial is the default visual selection; the user can flip it.
  const [units, setUnits] = useState("imperial");
  const [gender, setGender] = useState(null);
  const [homeGym, setHomeGym] = useState("");
  const [experienceLevel, setExperienceLevel] = useState(null);
  const [goal, setGoal] = useState(null);
  const [weeklyWorkoutGoal, setWeeklyWorkoutGoal] = useState(null);
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightLb, setWeightLb] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const computedHeightCm = () => {
    if (units === "imperial") {
      const f = parseInt(heightFeet) || 0;
      const i = parseInt(heightInches) || 0;
      if (f === 0 && i === 0) return null;
      return Math.round((f * 12 + i) * 2.54);
    }
    const cm = parseInt(heightCm);
    return Number.isFinite(cm) ? cm : null;
  };

  const computedWeightKg = () => {
    if (units === "imperial") {
      const l = parseFloat(weightLb);
      return Number.isFinite(l) && l > 0 ? Math.round((l / 2.205) * 10) / 10 : null;
    }
    const kg = parseFloat(weightKg);
    return Number.isFinite(kg) && kg > 0 ? kg : null;
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onComplete({
        name: name.trim(),
        units,
        heightCm: computedHeightCm(),
        weightKg: computedWeightKg(),
        gender,
        homeGym: homeGym.trim(),
        goal,
        experienceLevel,
        weeklyWorkoutGoal,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onComplete({});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout subtitle="Welcome — let's set things up">
      <div className="surface border border-soft card-shadow rounded-2xl p-6 space-y-5">
        <div className="text-xs text-navy-500 leading-relaxed">
          All fields optional. You can skip this and fill it in from your profile any time.
        </div>

        <Field label="Full name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </Field>

        <Field label="Preferred units">
          <div className="flex gap-1.5">
            <Chip active={units === "imperial"} onClick={() => setUnits("imperial")}>Imperial (lb, ft)</Chip>
            <Chip active={units === "metric"} onClick={() => setUnits("metric")}>Metric (kg, cm)</Chip>
          </div>
        </Field>

        <Field label="Height">
          {units === "imperial" ? (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={heightFeet} onChange={e => setHeightFeet(e.target.value)} onFocus={focusToEnd} className="w-20 surface-2 border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">ft</span>
              <input type="number" inputMode="numeric" value={heightInches} onChange={e => setHeightInches(e.target.value)} onFocus={focusToEnd} className="w-20 surface-2 border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">in</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={heightCm} onChange={e => setHeightCm(e.target.value)} onFocus={focusToEnd} className="w-24 surface-2 border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">cm</span>
            </div>
          )}
        </Field>

        <Field label="Weight">
          {units === "imperial" ? (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" value={weightLb} onChange={e => setWeightLb(e.target.value)} onFocus={focusToEnd} className="w-24 surface-2 border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">lb</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} onFocus={focusToEnd} className="w-24 surface-2 border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">kg</span>
            </div>
          )}
        </Field>

        <Field label="Gender">
          <div className="flex flex-wrap gap-1.5">
            {GENDER_OPTIONS.map(g => (
              <Chip key={g} active={gender === g} onClick={() => setGender(g)}>{g}</Chip>
            ))}
          </div>
        </Field>

        <Field label="Home gym">
          <input
            value={homeGym}
            onChange={e => setHomeGym(e.target.value)}
            placeholder="e.g. Synergy Health & Sports Performance"
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </Field>

        <Field label="Fitness goal">
          <div className="flex flex-wrap gap-1.5">
            {GOAL_OPTIONS.map(g => (
              <Chip key={g} active={goal === g} onClick={() => setGoal(g)}>{g}</Chip>
            ))}
          </div>
        </Field>

        <Field label="Experience level">
          <div className="flex flex-wrap gap-1.5">
            {EXPERIENCE_OPTIONS.map(e => (
              <Chip key={e} active={experienceLevel === e} onClick={() => setExperienceLevel(e)}>{e}</Chip>
            ))}
          </div>
        </Field>

        <Field label="Weekly workout target">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={weeklyWorkoutGoal == null} onClick={() => setWeeklyWorkoutGoal(null)}>No goal</Chip>
            {[2, 3, 4, 5, 6, 7].map(n => (
              <Chip key={n} active={weeklyWorkoutGoal === n} onClick={() => setWeeklyWorkoutGoal(n)}>{n}</Chip>
            ))}
          </div>
        </Field>

        {saveError && <AuthError message={saveError} />}

        <div className="pt-2 space-y-2">
          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition"
            style={{ background: "var(--primary)" }}
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="w-full text-sm text-navy-500 hover:text-navy-900 disabled:opacity-60 transition py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition font-medium"
      style={{
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "white" : "var(--navy-600)",
        borderColor: active ? "var(--primary)" : "var(--border)",
      }}
    >
      {children}
    </button>
  );
}
