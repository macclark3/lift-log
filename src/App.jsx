import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  TrendingUp, Plus, Check, ChevronRight, Dumbbell, Clock, Flame, ArrowUp, Minus,
  Play, X, Edit3, History, ListChecks, Heart, Home, Trash2, ChevronLeft, GripVertical,
  Activity, Footprints, Trophy, Scale, Search, Library, Sparkles,
  User, Mail, Calendar, CalendarCheck, Ruler, Target, Download, Camera, LogOut, Settings,
  Smartphone, ChevronDown, ChevronUp, AlertTriangle, Sun
} from "lucide-react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useSessionState, signOut } from "./lib/auth";
import { supabase } from "./lib/supabase";
import { focusToEnd } from "./lib/inputs";
import { ageFromDob, formatDateOfBirth, MIN_AGE } from "./lib/dob";
import { AuthGate } from "./auth/AuthGate";
import { SetNewPasswordScreen } from "./auth/SetNewPasswordScreen";
import { OnboardingScreen } from "./auth/OnboardingScreen";
import { AuthLoading, ProfileLoadError } from "./auth/AuthLayout";
import pkg from "../package.json";

const APP_VERSION = pkg.version;

// --- SETTINGS DEFAULTS ---
// Source of truth for setting defaults. Read paths in App.jsx merge a
// user's persisted settings JSON over these so missing keys (or pre-
// settings users) get sensible behavior. Don't reach into this directly
// from components — go through profile.settings, which already includes
// the merged values.
const DEFAULT_SETTINGS = {
  theme: "light",          // 'light' | 'dark' | 'system' — Phase A persists, Phase B applies
  showLevelUpAlerts: true, // hides bumped/holdLonger/leveledUp UI when false
  visibleHomeStats: {
    volume: true,
    sets: true,
    reps: true,
  },
  defaultUnit: "lb",       // 'lb' | 'kg' — pre-fills the unit field on new exercises
};

function mergeSettings(persisted) {
  const p = persisted || {};
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    visibleHomeStats: {
      ...DEFAULT_SETTINGS.visibleHomeStats,
      ...(p.visibleHomeStats || {}),
    },
  };
}

// --- SEED PLANS ---
// Exercises are no longer seeded — every user sees the public catalog
// (visibility='public', user_id NULL) automatically via RLS. Plans
// remain per-user and get this starter set on first signup.
const seedPlans = [
  { id: "p1", name: "Push Day A", description: "Chest, shoulders, triceps", exercises: ["Bench Press", "Incline Dumbell Press", "Lateral Raises", "Cable Tricep Extension"] },
  { id: "p2", name: "Pull Day A", description: "Back & biceps", exercises: ["Cable Rows", "Lat Pulldowns", "Dumbbell Curls", "Hammer Curls", "Face Pulls"] },
];

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Cardio", "Other"];
const EQUIPMENT_TYPES = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell", "Other"];

// --- HELPERS ---
// tracksWeight defaults to true: legacy library entries (and exercises predating
// this field) are weighted. Only an explicit `false` means bodyweight.
function tracksWeightFor(libEx) {
  return libEx?.tracksWeight !== false;
}

// trackingMode defaults to 'reps' for legacy/missing values. Time-tracked
// exercises (planks, hangs, etc.) store their second-counts in the same
// reps array — only the display label and stat math differ.
function trackingModeFor(libEx) {
  return libEx?.trackingMode === "time" ? "time" : "reps";
}
function isTimeTracked(libEx) {
  return trackingModeFor(libEx) === "time";
}
// Single-letter unit suffix used in compact set readouts ("45s · 60s · 30s").
function setUnitSuffix(libEx) {
  return isTimeTracked(libEx) ? "s" : "";
}

// Progression rule is configurable per exercise:
//   "all"    – every set must hit the top of the rep range (conservative, good for compounds)
//   "any"    – any single set hitting the top is enough (aggressive, good for isolation)
//   "majority" – more than half the sets hit the top (middle-ground)
function getProgressionStatus(entry, libEx) {
  if (!entry) return null;
  const [min, max] = entry.targetReps;
  const rule = libEx?.bumpRule || entry.bumpRule || "all";
  const sets = entry.reps.length;
  const hitTop = entry.reps.filter(r => r >= max).length;
  const anyBelowMin = entry.reps.some(r => r < min);
  const weighted = tracksWeightFor(libEx);
  const goal = weighted ? "bump the weight" : "push for more reps";

  let shouldBump = false;
  let bumpMessage = "";
  if (rule === "any") {
    shouldBump = sets >= 1 && hitTop >= 1;
    bumpMessage = `Hit ${max}+ on a set — ${goal}`;
  } else if (rule === "majority") {
    shouldBump = sets >= 2 && hitTop > sets / 2;
    bumpMessage = `Hit ${max}+ on most sets — ${goal}`;
  } else {
    // "all" (default)
    shouldBump = sets >= 3 && hitTop === sets;
    bumpMessage = `Hit ${max}+ on every set — ${goal}`;
  }

  if (shouldBump) return { status: "bump", message: bumpMessage };
  if (anyBelowMin) return { status: "hold", message: `Some sets under ${min} reps — stay here` };
  return { status: "progress", message: `Working toward ${max} reps × ${sets} sets` };
}

function suggestedNextWeight(entry, libEx) {
  // Use the exercise's configured increment, or fall back to a sensible default
  const increment = libEx?.increment ?? (entry.weight < 50 ? 2.5 : 5);
  return Math.round((entry.weight + increment) * 2) / 2;
}

// Next rep target for a bodyweight exercise that's earned a bump:
// push past the top of the current range by one rep.
function suggestedNextReps(entry) {
  return entry.targetReps[1] + 1;
}

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

// Profile is "complete enough" to skip the welcome flow when the canonical
// must-set fields all have values. This is the source of truth for whether
// a user has been onboarded — the per-user localStorage flag below is just
// a fast-path cache.
//
// Why this list: name powers the profile bubble + greeting; height and
// weight are the two body-metric fields the welcome form mandates. DOB is
// excluded because it's set during signup itself, before welcome runs.
function isProfileComplete(profile) {
  if (!profile) return false;
  return !!(profile.name && profile.name.trim()) &&
    profile.heightCm != null &&
    profile.weightKg != null;
}

// Map a row from the Supabase `profiles` table back to the app's camelCase
// profile shape. Defensive against missing columns (an older schema returns
// undefined for fields the writer hadn't synced yet) — falls back to sensible
// defaults so consumers never crash on a partial row. Email always prefers
// the row value, falls back to the auth session's email.
function mapRowToProfile(row, fallbackEmail) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || fallbackEmail || "",
    name: row.name || "",
    photo: row.photo || null,
    dateOfBirth: row.date_of_birth || null,
    heightCm: row.height_cm ?? null,
    weightKg: row.weight_kg ?? null,
    gender: row.gender ?? null,
    goal: row.goal ?? null,
    homeGym: row.home_gym || "",
    units: row.units || "imperial",
    memberSince: row.member_since || null,
    experienceLevel: row.experience_level ?? null,
    weeklyWorkoutGoal: row.weekly_workout_goal ?? null,
    // settings is a jsonb column with per-key defaults. Merging here
    // means downstream consumers can read profile.settings.foo without
    // null-checking, and pre-settings rows behave like everyone else.
    settings: mergeSettings(row.settings),
  };
}

// Exercises and plans use the same camelCase ↔ snake_case dance as profile.
// Mappers are defensive against missing columns / nulls so the app still
// renders cleanly if the schema ever drifts.

function mapRowToExercise(row) {
  return {
    id: row.id,
    name: row.name || "",
    targetReps: [row.target_reps_min ?? 0, row.target_reps_max ?? 0],
    unit: row.unit || "lb",
    muscle: row.muscle || null,
    equipment: row.equipment || null,
    bumpRule: row.bump_rule || "all",
    increment: row.increment ?? 5,
    // Default true matches the JS-side convention: undefined / null means
    // "weighted exercise" unless the row explicitly sets tracks_weight=false.
    tracksWeight: row.tracks_weight !== false,
    // Default 'reps' so rows that predate this column behave exactly as
    // they did before (and the DB CHECK constraint keeps us honest).
    trackingMode: row.tracking_mode === "time" ? "time" : "reps",
    // Ownership signals. Public catalog rows have user_id NULL and
    // visibility 'public'; the user can't edit/delete them, only
    // "Customize" (insert a private copy).
    userId: row.user_id || null,
    visibility: row.visibility === "public" ? "public" : "private",
  };
}

// Build a row for INSERT (needs user_id, no id — Supabase generates it).
function exerciseToDbRow(ex, userId) {
  return {
    user_id: userId,
    name: ex.name || null,
    target_reps_min: ex.targetReps?.[0] ?? null,
    target_reps_max: ex.targetReps?.[1] ?? null,
    unit: ex.unit ?? null,
    muscle: ex.muscle ?? null,
    equipment: ex.equipment ?? null,
    bump_rule: ex.bumpRule ?? null,
    increment: ex.increment ?? null,
    tracks_weight: ex.tracksWeight !== false,
    tracking_mode: ex.trackingMode === "time" ? "time" : "reps",
    visibility: "private",
  };
}

// Build an UPDATE patch — only fields actually present in the input go through
// so we don't accidentally null out columns the form didn't touch.
function exerciseToDbPatch(patch) {
  const out = {};
  if ("name" in patch) out.name = patch.name || null;
  if ("targetReps" in patch) {
    out.target_reps_min = patch.targetReps?.[0] ?? null;
    out.target_reps_max = patch.targetReps?.[1] ?? null;
  }
  if ("unit" in patch) out.unit = patch.unit ?? null;
  if ("muscle" in patch) out.muscle = patch.muscle ?? null;
  if ("equipment" in patch) out.equipment = patch.equipment ?? null;
  if ("bumpRule" in patch) out.bump_rule = patch.bumpRule ?? null;
  if ("increment" in patch) out.increment = patch.increment ?? null;
  if ("tracksWeight" in patch) out.tracks_weight = patch.tracksWeight !== false;
  if ("trackingMode" in patch) out.tracking_mode = patch.trackingMode === "time" ? "time" : "reps";
  return out;
}

function mapRowToPlan(row) {
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    exercises: row.exercises || [],
  };
}

function planToDbRow(plan, userId) {
  return {
    user_id: userId,
    name: plan.name || null,
    description: plan.description || null,
    exercises: plan.exercises || [],
    visibility: "private",
  };
}

function planToDbPatch(patch) {
  const out = {};
  if ("name" in patch) out.name = patch.name || null;
  if ("description" in patch) out.description = patch.description || null;
  if ("exercises" in patch) out.exercises = patch.exercises || [];
  return out;
}

// Sessions and history follow the same translation pattern. History entries
// reference their parent session via workoutId in app state and session_id
// in the DB; the foreign key has ON DELETE CASCADE so deleting a session
// removes its history rows automatically.

function mapRowToSession(row) {
  return {
    id: row.id,
    name: row.name || "Workout",
    startedAt: row.started_at,
    // Preserve null endedAt so callers can detect a session that's been
    // resumed (and is currently the active workout). The Past tab filters
    // these out; finishing the active workout writes ended_at and the
    // session reappears in the list.
    endedAt: row.ended_at || null,
  };
}

function mapRowToHistoryEntry(row) {
  return {
    id: row.id,
    workoutId: row.session_id,
    exercise: row.exercise_name,
    weight: row.weight ?? 0,
    reps: row.reps || [],
    targetReps: [row.target_reps_min ?? 0, row.target_reps_max ?? 0],
    unit: row.unit || "lb",
    note: row.note || undefined,
    date: row.logged_at,
  };
}

function historyEntryToDbRow(entry, userId, sessionId) {
  return {
    user_id: userId,
    session_id: sessionId,
    exercise_name: entry.exercise,
    weight: entry.weight ?? 0,
    reps: entry.reps || [],
    target_reps_min: entry.targetReps?.[0] ?? null,
    target_reps_max: entry.targetReps?.[1] ?? null,
    unit: entry.unit || "lb",
    note: entry.note || null,
    logged_at: entry.date || new Date().toISOString(),
  };
}

// Inverse mapping: turn a camelCase patch into the snake_case payload for an
// UPDATE. Only writable fields are forwarded (id and email are managed by
// Supabase auth + trigger; memberSince is set at signup and never edited).
// Empty strings collapse to null on text fields so the DB stays clean.
function profileToDbPatch(patch) {
  const out = {};
  if ("name" in patch) out.name = patch.name || null;
  if ("photo" in patch) out.photo = patch.photo || null;
  if ("dateOfBirth" in patch) out.date_of_birth = patch.dateOfBirth || null;
  if ("heightCm" in patch) out.height_cm = patch.heightCm ?? null;
  if ("weightKg" in patch) out.weight_kg = patch.weightKg ?? null;
  if ("gender" in patch) out.gender = patch.gender ?? null;
  if ("goal" in patch) out.goal = patch.goal ?? null;
  if ("homeGym" in patch) out.home_gym = patch.homeGym || null;
  if ("units" in patch) out.units = patch.units ?? null;
  if ("experienceLevel" in patch) out.experience_level = patch.experienceLevel ?? null;
  if ("weeklyWorkoutGoal" in patch) out.weekly_workout_goal = patch.weeklyWorkoutGoal ?? null;
  // Persist the entire settings object as a jsonb blob. Callers that
  // toggle a single setting still pass the merged result so the DB
  // value stays whole — this avoids a partial write clobbering keys
  // we didn't include.
  if ("settings" in patch) out.settings = patch.settings ?? {};
  return out;
}

// --- ROOT ---
export default function App() {
  // All persisted data except activeWorkout is now Supabase-backed (the
  // migrations in order: profile → exercises/plans → sessions/history).
  // Old localStorage keys liftlog:profile/exercises/plans/sessions/history
  // are no longer read or written; orphaned values, if any, just sit
  // there. activeWorkout (below) intentionally stays in localStorage —
  // mid-workout writes shouldn't depend on the network.
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [plans, setPlans] = useState([]);
  // Profile is also Supabase-backed (migration 1).
  const [profile, setProfile] = useState(null);
  // Save errors surface inline in their respective forms. Cleared on view
  // navigation (see popView/pushView/resetView below) so a stale error
  // doesn't show when the user opens the next form.
  const [profileSaveError, setProfileSaveError] = useState(null);
  const [librarySaveError, setLibrarySaveError] = useState(null);
  // Single error + retry tick covering the initial parallel fetch of
  // profile/exercises/plans. If anything fails we render ProfileLoadError
  // and the retry refetches all three together.
  const [initialDataError, setInitialDataError] = useState(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [initialDataFetchTick, setInitialDataFetchTick] = useState(0);
  const [tab, setTab] = useState("home");
  // Navigation is a stack: each pushView appends, popView trims the last entry,
  // resetView clears it. The current view is the top of the stack (or null when
  // the user is sitting on a top-level tab).
  const [viewStack, setViewStack] = useState([]);
  const view = viewStack[viewStack.length - 1] || null;
  // Navigation also clears transient form save errors so a stale banner
  // doesn't follow the user into their next form mount.
  const clearSaveErrors = () => {
    setProfileSaveError(null);
    setLibrarySaveError(null);
  };
  const pushView = (v) => { setViewStack(stack => [...stack, v]); clearSaveErrors(); };
  const popView = () => { setViewStack(stack => stack.slice(0, -1)); clearSaveErrors(); };
  const resetView = () => { setViewStack([]); clearSaveErrors(); };
  const [activeWorkout, setActiveWorkout] = useLocalStorage("activeWorkout", null);

  const lastByExercise = useMemo(() => {
    const map = new Map();
    [...history].sort((a, b) => b.date.localeCompare(a.date)).forEach(entry => {
      if (!map.has(entry.exercise)) map.set(entry.exercise, entry);
    });
    return map;
  }, [history]);

  const recentExercisesList = useMemo(() => Array.from(lastByExercise.values()), [lastByExercise]);

  // Recent workouts list excludes any session whose endedAt is null —
  // that's a resumed session currently in flight as the activeWorkout
  // and showing it twice (once in the recent list and again in the
  // "Resume Workout" hero) would be confusing.
  const recentSessions = useMemo(() => {
    return [...sessions]
      .filter(s => s.endedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [sessions]);

  // Library writes are pessimistic on create (we wait for the inserted row
  // to come back so we can use the server-generated id) and optimistic on
  // update / delete (rolled back on failure). Errors surface via
  // librarySaveError; the active form renders an inline banner.

  const addExerciseToLibrary = async (newEx) => {
    if (!session) return null;
    setLibrarySaveError(null);
    const dbRow = exerciseToDbRow(newEx, session.user.id);
    const { data, error } = await supabase
      .from("exercises")
      .insert([dbRow])
      .select()
      .single();
    if (error) {
      setLibrarySaveError(error.message || "Couldn't save the exercise. Check your connection and try again.");
      return null;
    }
    const created = mapRowToExercise(data);
    setExercises(prev => [...prev, created]);
    return created;
  };

  const updateExerciseInLibrary = async (id, patch) => {
    if (!session) return false;
    setLibrarySaveError(null);
    const previous = exercises;
    setExercises(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    const dbPatch = exerciseToDbPatch(patch);
    const { error } = await supabase
      .from("exercises")
      .update(dbPatch)
      .eq("id", id);
    if (error) {
      setExercises(previous);
      setLibrarySaveError(error.message || "Couldn't update the exercise. Check your connection and try again.");
      return false;
    }
    return true;
  };

  // Public catalog → private copy. Used from ExerciseDetailView (Customize
  // button) and ExerciseEditView (Customize-instead-of-Save when public).
  // Inserts a private copy of the source's editable fields, then swaps the
  // current view for an edit screen on the new private id so the user can
  // immediately tune the defaults. Returns the created exercise on success.
  const customizeExerciseAndOpenEdit = async (source) => {
    if (!source) return null;
    const created = await addExerciseToLibrary({
      name: source.name,
      muscle: source.muscle,
      equipment: source.equipment,
      targetReps: source.targetReps,
      unit: source.unit,
      tracksWeight: source.tracksWeight,
      trackingMode: source.trackingMode,
      bumpRule: source.bumpRule,
      increment: source.increment,
    });
    if (created) {
      popView();
      pushView({ type: "exercise-edit", id: created.id });
    }
    return created;
  };

  const deleteExerciseFromLibrary = async (id) => {
    if (!session) return false;
    setLibrarySaveError(null);
    const previous = exercises;
    setExercises(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase
      .from("exercises")
      .delete()
      .eq("id", id);
    if (error) {
      setExercises(previous);
      setLibrarySaveError(error.message || "Couldn't delete the exercise. Check your connection and try again.");
      return false;
    }
    return true;
  };

  const startWorkout = (planExercises = null) => {
    // Already have a workout in flight — never start a second. Resume the
    // existing one instead so we don't lose its state.
    if (activeWorkout) {
      setActiveWorkout({ ...activeWorkout, minimized: false });
      return;
    }
    const id = `w${Date.now()}`;
    setActiveWorkout({
      id,
      startedAt: new Date().toISOString(),
      exercises: [],
      planQueue: planExercises || [],
      minimized: false,
    });
    // No detail view stacked beneath; the workout view renders independently.
    setViewStack([]);
  };

  // Hide the active workout view but keep its state alive so the rest timer
  // and per-set inputs survive navigation. Reset the view stack so the user
  // lands on whatever tab they were on.
  const minimizeWorkout = () => {
    if (!activeWorkout) return;
    setActiveWorkout({ ...activeWorkout, minimized: true });
    setViewStack([]);
  };

  // Bring the workout view back to the foreground. viewStack is left alone —
  // any detail navigation underneath is preserved for after the user
  // re-minimizes (they can pop back to it).
  const resumeWorkout = () => {
    if (!activeWorkout) return;
    setActiveWorkout({ ...activeWorkout, minimized: false });
  };

  // Pull a finished session back into the live activeWorkout state.
  // - The session row's started_at moves to (NOW - 30min) and ended_at
  //   clears to null, so duration math reads ~30:00 on entry and the
  //   session attributes to today once finished again.
  // - History rows stay attached; we just rebuild the active workout's
  //   in-memory exercise objects from them.
  // - The same session id stays in play through finish, so finishing
  //   the resumed workout updates this row instead of creating a
  //   duplicate.
  // - Blocked when an activeWorkout is already in flight (caller checks
  //   activeWorkout itself; this is also defended here).
  // Returns true on success.
  const resumeSession = async (sessionId) => {
    if (!session) return false;
    if (activeWorkout) {
      setLibrarySaveError("You have a workout in progress. Finish or discard it before resuming another.");
      return false;
    }
    setLibrarySaveError(null);
    const sourceSession = sessions.find(s => s.id === sessionId);
    if (!sourceSession) return false;

    const newStartedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from("sessions")
      .update({ started_at: newStartedAt, ended_at: null })
      .eq("id", sessionId);
    if (updateErr) {
      setLibrarySaveError(updateErr.message || "Couldn't resume the workout. Check your connection and try again.");
      return false;
    }

    // Reconstruct the active-workout exercises from current history.
    // Sort by logged_at so the resumed view matches the original order.
    const sessionEntries = history
      .filter(h => h.workoutId === sessionId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const resumedExercises = sessionEntries.map(entry => {
      const libEx = exercises.find(e => e.name === entry.exercise);
      const weighted = tracksWeightFor(libEx);
      const mode = trackingModeFor(libEx);
      return {
        exercise: entry.exercise,
        weight: entry.weight ?? 0,
        // Suppress the "last time" hero — for resumed entries, the user
        // is already looking at their own logged values; the most-recent
        // history match is this same entry, which would be redundant.
        lastWeight: null,
        lastReps: [],
        lastDate: null,
        targetReps: libEx?.targetReps || entry.targetReps || [8, 12],
        unit: libEx?.unit || entry.unit || "lb",
        tracksWeight: weighted,
        trackingMode: mode,
        increment: libEx?.increment ?? 5,
        // Existing reps preserved verbatim, padded to a min of 1 so the
        // SetRow always has a row to interact with.
        reps: entry.reps && entry.reps.length > 0 ? [...entry.reps] : [0],
        note: entry.note || "",
        bumped: false,
        holdLonger: false,
      };
    });

    // Reflect the row's new timestamps in local sessions state. PastView
    // filters out null-endedAt rows, so the resumed session disappears
    // from the past list while it's live.
    setSessions(prev => prev.map(s => s.id === sessionId
      ? { ...s, startedAt: newStartedAt, endedAt: null }
      : s
    ));

    setActiveWorkout({
      id: `w${Date.now()}`,
      resumedSessionId: sessionId,
      resumedSessionName: sourceSession.name,
      // Original timestamps are stashed so cancelWorkout can restore them
      // without us needing to know what they were at cancel time. History
      // rows are never modified during the resumed session, only on
      // finish — so cancel just needs to undo the started_at/ended_at
      // changes from the resume.
      resumedOriginalStartedAt: sourceSession.startedAt,
      resumedOriginalEndedAt: sourceSession.endedAt,
      startedAt: newStartedAt,
      exercises: resumedExercises,
      planQueue: [],
      minimized: false,
    });
    resetView();
    setTab("home");
    return true;
  };

  // Convert the in-flight activeWorkout into a persisted session + history
  // rows. Two flows depending on whether the workout was resumed from a
  // past session:
  //   - resumedSessionId set: UPDATE the existing session row (ended_at,
  //     possibly name) and replace its history rows via updateSession's
  //     delete-then-insert path.
  //   - otherwise: INSERT a new session, then bulk-insert history
  //     referencing it. Orphan-session cleanup if history insert fails.
  // Returns true on success (caller closes the finish modal); false on
  // failure (activeWorkout is preserved so the user can retry).
  const finishWorkout = async (workoutName) => {
    if (!activeWorkout) return false;
    const completed = activeWorkout.exercises.filter(ex => ex.reps.some(r => r > 0));
    const trimmedName = (workoutName && workoutName.trim()) || "Workout";

    if (completed.length === 0 || !session) {
      // Empty workout — nothing to persist, just discard.
      // For a resumed session this would normally drop all the
      // previously-logged sets; safer to refuse the finish so the user
      // can pick what to do.
      if (activeWorkout.resumedSessionId) {
        setLibrarySaveError("This resumed workout has no sets. Add some, or discard to delete the original.");
        return false;
      }
      setActiveWorkout(null); resetView(); setTab("home");
      return true;
    }

    setLibrarySaveError(null);
    const userId = session.user.id;
    const startedAt = activeWorkout.startedAt;
    const endedAt = new Date().toISOString();

    // --- Resumed-session flow: UPDATE in place. ---
    if (activeWorkout.resumedSessionId) {
      const sessionId = activeWorkout.resumedSessionId;
      const baseTime = new Date(startedAt).getTime();
      // Build the same shape historyEntryToDbRow expects — id is unset
      // since the rows will be reinserted with fresh ids.
      const updatedEntries = completed.map((ex, i) => ({
        date: new Date(baseTime + i * 60000).toISOString(),
        exercise: ex.exercise,
        weight: ex.weight ?? 0,
        reps: ex.reps.filter(r => r > 0),
        targetReps: ex.targetReps,
        unit: ex.unit || "lb",
        note: ex.note || undefined,
      }));
      const ok = await updateSession(
        sessionId,
        { name: trimmedName, startedAt, endedAt },
        updatedEntries,
      );
      if (!ok) return false;
      setActiveWorkout(null);
      resetView();
      setTab("home");
      return true;
    }

    // --- Fresh-session flow: INSERT session, then INSERT history. ---
    // 1) Insert the session.
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("sessions")
      .insert([{
        user_id: userId,
        name: trimmedName,
        started_at: startedAt,
        ended_at: endedAt,
      }])
      .select()
      .single();

    if (sessionErr || !sessionRow) {
      setLibrarySaveError(sessionErr?.message || "Couldn't save the workout. Check your connection and try again.");
      return false;
    }

    // 2) Insert history rows referencing the new session id. Spread each
    // entry's logged_at by a minute so they sort in the order they were
    // logged (matches the original local-only behavior).
    const baseTime = new Date(startedAt).getTime();
    const historyRows = completed.map((ex, i) => ({
      user_id: userId,
      session_id: sessionRow.id,
      exercise_name: ex.exercise,
      weight: ex.weight ?? 0,
      reps: ex.reps.filter(r => r > 0),
      target_reps_min: ex.targetReps?.[0] ?? null,
      target_reps_max: ex.targetReps?.[1] ?? null,
      unit: ex.unit || "lb",
      note: ex.note || null,
      logged_at: new Date(baseTime + i * 60000).toISOString(),
    }));

    const { data: insertedHistory, error: historyErr } = await supabase
      .from("history")
      .insert(historyRows)
      .select();

    if (historyErr || !insertedHistory) {
      // Roll back the orphan session so the Past tab doesn't show an empty
      // workout. We don't surface the cleanup result to the user — even if
      // delete fails, the retry will just create another session.
      await supabase.from("sessions").delete().eq("id", sessionRow.id);
      setLibrarySaveError(historyErr?.message || "Couldn't save your sets. Check your connection and try again.");
      return false;
    }

    // 3) Persist locally and clear the in-flight workout.
    setSessions(prev => [mapRowToSession(sessionRow), ...prev]);
    setHistory(prev => [...insertedHistory.map(mapRowToHistoryEntry), ...prev]);
    setActiveWorkout(null);
    resetView();
    setTab("home");
    return true;
  };

  // Cancel discards the in-flight workout. For resumed sessions we
  // also have to undo the started_at/ended_at mutation done by
  // resumeSession — otherwise the session would be left as an orphan
  // (endedAt null, hidden from the past list, no UI to recover it).
  // History rows are untouched since the resumed session never modifies
  // them in flight; only finish does. Best-effort: if the restore call
  // fails, we still clear local state so the user isn't stuck.
  const cancelWorkout = async () => {
    const w = activeWorkout;
    setActiveWorkout(null);
    resetView();
    setTab("home");
    if (!w?.resumedSessionId) return;
    const { resumedSessionId, resumedOriginalStartedAt, resumedOriginalEndedAt } = w;
    setSessions(prev => prev.map(s => s.id === resumedSessionId
      ? { ...s, startedAt: resumedOriginalStartedAt, endedAt: resumedOriginalEndedAt }
      : s
    ));
    const { error } = await supabase
      .from("sessions")
      .update({
        started_at: resumedOriginalStartedAt,
        ended_at: resumedOriginalEndedAt,
      })
      .eq("id", resumedSessionId);
    if (error) console.warn("[resume] cancel failed to restore session timestamps:", error);
  };

  // Edit a past session: rename and/or replace its history entries. The
  // entries replace is a delete-then-insert against Supabase (simpler than
  // diffing). Local state is optimistically updated and rolled back on
  // failure. Returns true on success.
  //
  // Partial-failure note: if the delete succeeds but the re-insert fails,
  // the session ends up with no history rows in Supabase. The user retries
  // (delete becomes a no-op, insert succeeds). Local state mirrors the
  // intended-after-save state during the retry window.
  const updateSession = async (sessionId, sessionPatch, updatedEntries) => {
    if (!session) return false;
    setLibrarySaveError(null);
    const previousSessions = sessions;
    const previousHistory = history;

    // Optimistic update.
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...sessionPatch } : s));
    if (updatedEntries) {
      setHistory(prev => [
        ...prev.filter(h => h.workoutId !== sessionId),
        ...updatedEntries,
      ]);
    }

    // 1) Update the session row.
    const dbSessionPatch = {};
    if ("name" in sessionPatch) dbSessionPatch.name = sessionPatch.name;
    if ("startedAt" in sessionPatch) dbSessionPatch.started_at = sessionPatch.startedAt;
    if ("endedAt" in sessionPatch) dbSessionPatch.ended_at = sessionPatch.endedAt;

    if (Object.keys(dbSessionPatch).length > 0) {
      const { error: sessionErr } = await supabase
        .from("sessions")
        .update(dbSessionPatch)
        .eq("id", sessionId);
      if (sessionErr) {
        setSessions(previousSessions);
        setHistory(previousHistory);
        setLibrarySaveError(sessionErr.message || "Couldn't save changes. Check your connection and try again.");
        return false;
      }
    }

    if (updatedEntries) {
      // 2) Wipe existing history rows for this session.
      const { error: deleteErr } = await supabase
        .from("history")
        .delete()
        .eq("session_id", sessionId);
      if (deleteErr) {
        setSessions(previousSessions);
        setHistory(previousHistory);
        setLibrarySaveError(deleteErr.message || "Couldn't save changes. Check your connection and try again.");
        return false;
      }

      // 3) Insert the new entries (if any). Empty array = the user removed
      // every entry; we just leave the session with no rows.
      if (updatedEntries.length > 0) {
        const newRows = updatedEntries.map(e => historyEntryToDbRow(e, session.user.id, sessionId));
        const { data: insertedRows, error: insertErr } = await supabase
          .from("history")
          .insert(newRows)
          .select();
        if (insertErr) {
          setSessions(previousSessions);
          setHistory(previousHistory);
          setLibrarySaveError(insertErr.message || "Couldn't save changes. Check your connection and try again.");
          return false;
        }
        // Replace local entries with the inserted rows so the in-memory
        // ids match Supabase's.
        setHistory(prev => [
          ...prev.filter(h => h.workoutId !== sessionId),
          ...insertedRows.map(mapRowToHistoryEntry),
        ]);
      }
    }
    return true;
  };

  // Delete a past session. The history.session_id foreign key has
  // ON DELETE CASCADE, so the matching history rows go with it.
  const deleteSession = async (sessionId) => {
    if (!session) return false;
    setLibrarySaveError(null);
    const previousSessions = sessions;
    const previousHistory = history;

    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setHistory(prev => prev.filter(h => h.workoutId !== sessionId));

    const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
    if (error) {
      setSessions(previousSessions);
      setHistory(previousHistory);
      setLibrarySaveError(error.message || "Couldn't delete the workout. Check your connection and try again.");
      return false;
    }
    return true;
  };

  const savePlan = async (plan) => {
    if (!session) return false;
    setLibrarySaveError(null);
    if (plan.id) {
      // Update — optimistic with rollback.
      const previous = plans;
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, ...plan } : p));
      const dbPatch = planToDbPatch(plan);
      const { error } = await supabase
        .from("plans")
        .update(dbPatch)
        .eq("id", plan.id);
      if (error) {
        setPlans(previous);
        setLibrarySaveError(error.message || "Couldn't save the plan. Check your connection and try again.");
        return false;
      }
      return true;
    }
    // Create — pessimistic, use returned row to capture the server-generated id.
    const dbRow = planToDbRow(plan, session.user.id);
    const { data, error } = await supabase
      .from("plans")
      .insert([dbRow])
      .select()
      .single();
    if (error) {
      setLibrarySaveError(error.message || "Couldn't save the plan. Check your connection and try again.");
      return false;
    }
    setPlans(prev => [...prev, mapRowToPlan(data)]);
    return true;
  };

  const deletePlan = async (id) => {
    if (!session) return false;
    setLibrarySaveError(null);
    const previous = plans;
    setPlans(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("id", id);
    if (error) {
      setPlans(previous);
      setLibrarySaveError(error.message || "Couldn't delete the plan. Check your connection and try again.");
      return false;
    }
    return true;
  };

  // The workout view is foregrounded whenever an active workout exists and
  // hasn't been minimized. It's mounted (but display:none'd) when minimized
  // so internal state — the rest timer especially — survives navigation.
  const showWorkoutView = !!activeWorkout && !activeWorkout.minimized;
  // Any pushed view counts as a "detail" navigation; the tab content hides
  // when this is set.
  const renderingDetail = !!view;

  // Auth state drives the top-level view. The order matters:
  //   1. loading: don't flash the login form before we know the user state
  //   2. password recovery: takes priority even over an active session
  //   3. signed out: show login/signup/forgot
  //   4. signed in but not initialized for this device: wipe + briefly show the
  //      loading state so we never render anyone else's data to a new user
  //   5. signed in but not onboarded: show the welcome form
  //   6. signed in + onboarded: the existing app
  const { session, loading: authLoading, isPasswordRecovery } = useSessionState();

  // Reset to Home whenever the user transitions from signed-out to signed-in.
  // tab/viewStack aren't persisted, so this only matters for the in-memory
  // state across an auth round-trip. WorkoutView is governed independently
  // by activeWorkout, so we don't push a "workout" view here — if a workout
  // is restored alongside the session, it renders foregrounded automatically.
  // Conversely, when we transition signed-in → signed-out, abandon any
  // in-flight workout (per spec: a workout is per-session).
  const prevSessionRef = useRef(null);
  useEffect(() => {
    const wasSignedOut = prevSessionRef.current === null;
    const wasSignedIn = prevSessionRef.current !== null;
    prevSessionRef.current = session;
    if (session && wasSignedOut) {
      setTab("home");
      setViewStack([]);
    } else if (!session && wasSignedIn) {
      setActiveWorkout(null);
      // Per-session state — drop everything Supabase-backed so the next
      // sign-in fetches fresh rather than rendering with stale data from
      // the previous user.
      setProfile(null);
      setExercises([]);
      setPlans([]);
      setSessions([]);
      setHistory([]);
      setInitialDataLoaded(false);
      setInitialDataError(null);
      setProfileSaveError(null);
      setLibrarySaveError(null);
      setDismissedOnboarding(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Synchronous read so already-initialized users never see a flash.
  // localStorage is shared across all users on this device; this flag
  // ensures we wipe & reset to a clean state the first time each userId
  // appears here, then never again for that user.
  const userInitKey = session ? `liftlog:initialized:${session.user.id}` : null;
  const userInitialized = userInitKey ? !!localStorage.getItem(userInitKey) : null;
  // Onboarded check combines a real profile-completeness signal with a
  // per-user localStorage cache. The profile check is the source of truth:
  //   - Fresh signup (profile name/height/weight all null) → not onboarded,
  //     show welcome regardless of any stale flag from a previous user.
  //   - Existing user with complete Supabase profile → onboarded even if
  //     localStorage was wiped (e.g. on a new device).
  //   - Continue with any data → flag set in finishOnboarding so subsequent
  //     sign-ins skip the profile check (perf cache).
  //   - Skip → flag NOT set, profile still incomplete → next sign-in
  //     re-prompts the welcome flow.
  // Old behavior used a heuristic over the device-shared liftlog:profile
  // legacy localStorage key, which falsely marked fresh users as onboarded
  // when ANY pre-Supabase data existed on the device.
  const onboardedFlagKey = session ? `liftlog:onboarded:${session.user.id}` : null;
  const onboardedFlagSet = onboardedFlagKey ? localStorage.getItem(onboardedFlagKey) === "true" : false;
  const userOnboarded = session ? (isProfileComplete(profile) || onboardedFlagSet) : null;
  // Skip is in-memory only — it dismisses the welcome screen for the
  // current session but does NOT persist. Next sign-in (or page refresh)
  // re-evaluates against the still-incomplete profile and re-prompts.
  // Cleared on sign-out below so a new sign-in starts fresh.
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);

  // First time we see this user on this device: wipe per-user localStorage
  // back to a clean state before they (or anyone else) sees the main app.
  // Triggers a re-render via the setters; the synchronous flag check above
  // will then return true.
  useEffect(() => {
    if (!session || userInitialized) return;
    setActiveWorkout(null);
    // All persisted data (profile, exercises, plans, sessions, history) is
    // Supabase-backed — the fetch effect below loads (and seeds, for
    // first-time users) what's needed.
    localStorage.setItem(userInitKey, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userInitialized]);

  // Cache the onboarded flag whenever we observe a complete profile (e.g.
  // an existing user signing in on a new device). Lets future renders
  // short-circuit without re-deriving completeness from the profile.
  useEffect(() => {
    if (!onboardedFlagKey || onboardedFlagSet) return;
    if (isProfileComplete(profile)) {
      localStorage.setItem(onboardedFlagKey, "true");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, onboardedFlagKey, onboardedFlagSet]);

  // Theme effect: applies the user's chosen theme to <html data-theme=...>
  // so the [data-theme="dark"] CSS overrides in index.css take effect.
  // Three modes:
  //   - 'light' / 'dark': set the attribute literally
  //   - 'system': follow prefers-color-scheme, and listen for changes so
  //     the OS-level toggle updates the app live without a sign-out
  // No profile (signed out / loading) → default to 'light' so the auth
  // screens render in their existing palette.
  const themePref = profile?.settings?.theme || "light";
  useEffect(() => {
    const root = document.documentElement;
    if (themePref === "dark" || themePref === "light") {
      root.setAttribute("data-theme", themePref);
      return;
    }
    // 'system'
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themePref]);

  // Single fetch effect that loads everything the app needs to render the
  // home screen: profile, exercises, plans. All three run in parallel.
  // If exercises is empty (first launch ever for this user) we batch-insert
  // the seed library + plans and use the returned rows as state. Anything
  // failing surfaces via initialDataError → ProfileLoadError gate, with a
  // retry that bumps initialDataFetchTick.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setInitialDataError(null);
    setInitialDataLoaded(false);

    (async () => {
      try {
        const userId = session.user.id;
        const [profileRes, exRes, plansRes, sessionsRes, historyRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          // Exercises: no user_id filter — RLS returns the user's private
          // rows AND every visibility='public' catalog row.
          supabase.from("exercises").select("*").order("created_at", { ascending: true }),
          supabase.from("plans").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
          supabase.from("sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
          supabase.from("history").select("*").eq("user_id", userId).order("logged_at", { ascending: false }),
        ]);
        if (cancelled) return;
        if (profileRes.error) throw profileRes.error;
        if (exRes.error) throw exRes.error;
        if (plansRes.error) throw plansRes.error;
        if (sessionsRes.error) throw sessionsRes.error;
        if (historyRes.error) throw historyRes.error;

        const profileObj = mapRowToProfile(profileRes.data, session.user.email);

        // The signup form puts date_of_birth into auth user_metadata, but
        // the handle_new_user trigger may not propagate it onto the
        // profiles row. If the row's DOB is missing while metadata has it,
        // sync the value here so it survives a refresh and shows up
        // correctly in the profile view. Failure is non-fatal — the user
        // can re-enter DOB from profile edit.
        const metaDob = session.user.user_metadata?.date_of_birth;
        if (!profileObj.dateOfBirth && metaDob) {
          const { error: dobErr } = await supabase
            .from("profiles")
            .update({ date_of_birth: metaDob })
            .eq("id", userId);
          if (cancelled) return;
          if (!dobErr) {
            profileObj.dateOfBirth = metaDob;
          } else {
            console.warn("[profiles] DOB backfill failed:", dobErr);
          }
        }

        const exercisesList = (exRes.data || []).map(mapRowToExercise);
        let plansList = (plansRes.data || []).map(mapRowToPlan);
        const sessionsList = (sessionsRes.data || []).map(mapRowToSession);
        const historyList = (historyRes.data || []).map(mapRowToHistoryEntry);

        // Plans seed: a true fresh-signup signal is "no plans AND no
        // sessions ever logged" — that combination distinguishes a
        // first-time user from someone who deliberately deleted all
        // their plans. Exercises are no longer seeded; public catalog
        // rows are visible to every user via RLS, so a fresh signup
        // already sees a full library on first load.
        if (plansList.length === 0 && sessionsList.length === 0) {
          const seededPlanRows = seedPlans.map(p => planToDbRow(p, userId));
          const planInsert = await supabase.from("plans").insert(seededPlanRows).select();
          if (cancelled) return;
          if (planInsert.error) throw planInsert.error;
          plansList = (planInsert.data || []).map(mapRowToPlan);
        }

        setProfile(profileObj);
        setExercises(exercisesList);
        setPlans(plansList);
        setSessions(sessionsList);
        setHistory(historyList);
        setInitialDataLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setInitialDataError(err.message || "Couldn't load your data. Check your connection and try again.");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, initialDataFetchTick]);

  const retryInitialDataFetch = () => setInitialDataFetchTick(t => t + 1);

  // Optimistic write with rollback. The local profile is updated immediately
  // so the UI feels responsive; if Supabase rejects the update we revert and
  // surface profileSaveError for the active form to render. Returns true on
  // success so the caller (ProfileEditView, OnboardingScreen) can decide
  // whether to dismiss itself.
  const updateProfile = async (patch) => {
    if (!session) return false;
    const previous = profile;
    const next = profile ? { ...profile, ...patch } : { ...patch };
    setProfile(next);
    setProfileSaveError(null);

    const dbPatch = profileToDbPatch(patch);
    if (Object.keys(dbPatch).length === 0) return true;

    const { error } = await supabase
      .from("profiles")
      .update(dbPatch)
      .eq("id", session.user.id);
    if (error) {
      setProfile(previous);
      setProfileSaveError(error.message || "Couldn't save your changes. Check your connection and try again.");
      return false;
    }
    return true;
  };

  // Apply a partial settings patch on top of the current merged settings
  // and persist the whole blob. Reuses updateProfile so optimistic-update
  // + rollback + error surface all come for free. settingsPatch can be
  // shallow (e.g. { theme: 'dark' }) or include nested objects (e.g.
  // { visibleHomeStats: { volume: false } }) — nested objects merge one
  // level deep.
  const updateSettings = async (settingsPatch) => {
    if (!profile) return false;
    const current = profile.settings || DEFAULT_SETTINGS;
    const nextSettings = {
      ...current,
      ...settingsPatch,
      visibleHomeStats: {
        ...current.visibleHomeStats,
        ...(settingsPatch.visibleHomeStats || {}),
      },
    };
    return updateProfile({ settings: nextSettings });
  };

  // Delete every row this user owns and sign them out. Public exercise
  // catalog rows are protected by RLS — DELETE WHERE user_id=auth.uid()
  // never touches them. Sessions cascade to their history rows on
  // delete (history.session_id has ON DELETE CASCADE) so we don't need
  // to delete history explicitly. Auth.users stays as a stub (no admin
  // API from the client); the user can re-register if they want.
  // Returns true on success; on failure surfaces the error and bails
  // before signing out so the user can retry.
  const deleteAccount = async () => {
    if (!session) return false;
    const userId = session.user.id;
    setLibrarySaveError(null);

    const tables = [
      // Order doesn't matter for correctness (each is RLS-scoped to
      // user_id), but doing sessions first means cascading deletes
      // clean up history before we get to it explicitly.
      { name: "sessions", filter: { user_id: userId } },
      { name: "history", filter: { user_id: userId } },
      { name: "plans", filter: { user_id: userId } },
      { name: "exercises", filter: { user_id: userId } },
      { name: "profiles", filter: { id: userId } },
    ];
    for (const t of tables) {
      let q = supabase.from(t.name).delete();
      for (const [col, val] of Object.entries(t.filter)) q = q.eq(col, val);
      const { error } = await q;
      if (error) {
        setLibrarySaveError(`Couldn't delete ${t.name}: ${error.message}`);
        return false;
      }
    }

    // Flash message read by the sign-in screen on next mount.
    try { sessionStorage.setItem("flash:accountDeleted", "1"); } catch {}
    await signOut();
    return true;
  };

  const finishOnboarding = async (patch) => {
    if (!session) return;
    const isSkip = Object.keys(patch).length === 0;
    if (!isSkip) {
      const ok = await updateProfile(patch);
      if (!ok) return; // user stays on welcome; saveError surfaces in the form
      // Continue with any data → cache the onboarded flag so subsequent
      // sign-ins skip the profile-completeness check. Even if the user
      // didn't fill in every field, tapping Continue is an explicit
      // "I'm done with welcome" — respect that.
      localStorage.setItem(`liftlog:onboarded:${session.user.id}`, "true");
      return;
    }
    // Skip: deliberately don't persist anything. Set the in-memory
    // dismissedOnboarding flag so the gate falls through to home for
    // this session, but on next sign-in / refresh the profile is still
    // incomplete and the flag is still missing → welcome re-prompts.
    setDismissedOnboarding(true);
  };

  let authShell = null;
  if (authLoading) authShell = <AuthLoading />;
  else if (isPasswordRecovery) authShell = <SetNewPasswordScreen />;
  else if (!session) authShell = <AuthGate />;
  else if (initialDataError) authShell = <ProfileLoadError onRetry={retryInitialDataFetch} />;
  else if (!initialDataLoaded) authShell = <AuthLoading />;
  else if (!userInitialized) authShell = <AuthLoading />;
  else if (!userOnboarded && !dismissedOnboarding) {
    authShell = <OnboardingScreen onComplete={finishOnboarding} saveError={profileSaveError} />;
  }

  return (
    <>
    <div
      className="rotate-warning min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        background: "var(--app-bg-gradient)",
      }}
    >
      <Smartphone size={28} className="text-navy-700 mb-3" />
      <div className="serif text-navy-900 text-xl mb-1" style={{ fontWeight: 500 }}>Rotate to portrait</div>
      <div className="text-sm text-navy-500 max-w-xs">Spotter works best in portrait. Please rotate your device.</div>
    </div>
    <div className="app-content min-h-screen text-navy-900" style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      background: "var(--app-bg-gradient)",
      color: "var(--navy-900)",
      // Bumps fixed-positioned bars (BottomBar in detail edit views) above the
      // minimized workout pill. ~56px pill + safe-area inset, give or take.
      "--bottom-stack-offset": activeWorkout && activeWorkout.minimized
        ? "calc(60px + env(safe-area-inset-bottom))"
        : "0px",
      // Each view (HomeView, LibraryView, PastView, etc.) sets its own pb-28
      // for the tab bar, but that doesn't account for the minimized workout
      // pill stacked above the tab bar. Add the stack offset here so when a
      // workout is minimized, every view gets the extra clearance — no per-
      // view padding bumps required. Bug symptom this avoids: the "Manage
      // exercise library" button (and other content at the bottom of Home)
      // sitting behind the minimized bar, making the library look
      // unreachable while a workout is in progress.
      paddingBottom: "var(--bottom-stack-offset, 0px)",
    }}>
      {/* Palette + utility classes moved into src/index.css so the
          [data-theme="dark"] overrides defined there can apply. */}

      {authShell || (
      <div className="max-w-md mx-auto min-h-screen relative grain" style={{ background: "var(--bg)" }}>
        <Header
          tab={tab}
          view={view}
          activeWorkout={activeWorkout}
          profile={profile}
          onBack={popView}
          onCancelWorkout={cancelWorkout}
          onMinimizeWorkout={minimizeWorkout}
          onOpenProfile={() => pushView({ type: "profile" })}
        />

        {/* Active workout — kept mounted whenever activeWorkout exists so the
            rest timer keeps ticking even while the user navigates. Hidden via
            display:none when minimized rather than unmounted. */}
        {activeWorkout && (
          <div style={{ display: activeWorkout.minimized ? "none" : "block" }}>
            <WorkoutView workout={activeWorkout} setWorkout={setActiveWorkout} exercises={exercises} lastByExercise={lastByExercise} settings={profile?.settings || DEFAULT_SETTINGS} onCreateExercise={addExerciseToLibrary} onFinish={finishWorkout} librarySaveError={librarySaveError} />
          </div>
        )}

        {/* Tab content + detail views render only when the workout view isn't
            foregrounded (either no active workout, or it's minimized). */}
        {!showWorkoutView && (
          <>
            {!renderingDetail && (
              <>
                {tab === "home" && (
                  <HomeView
                    recentSessions={recentSessions}
                    recentExercisesList={recentExercisesList}
                    sessions={sessions}
                    history={history}
                    plans={plans}
                    exercises={exercises}
                    profile={profile}
                    activeWorkout={activeWorkout}
                    onStartBlank={() => startWorkout()}
                    onStartFromPlan={(plan) => startWorkout(plan.exercises)}
                    onResume={resumeWorkout}
                    onSelectExercise={(name) => pushView({ type: "exercise", name })}
                    onSelectSession={(id) => pushView({ type: "session", id })}
                    onOpenLibrary={() => pushView({ type: "library" })}
                    onOpenProfileEdit={() => pushView({ type: "profile-edit" })}
                  />
                )}
                {tab === "past" && (
                  // Filter out resumed-in-flight sessions (endedAt null).
                  // They're live as the active workout; showing them in
                  // the past list would be misleading (and the duration
                  // / avg duration math would NaN on null endedAt).
                  <PastView sessions={sessions.filter(s => s.endedAt)} history={history} onSelectSession={(id) => pushView({ type: "session", id })} onGoHome={() => setTab("home")} />
                )}
                {tab === "plans" && (
                  <PlansView plans={plans} onCreate={() => pushView({ type: "plan-edit", id: null })} onEdit={(id) => pushView({ type: "plan-edit", id })} onUse={(plan) => startWorkout(plan.exercises)} />
                )}
                {tab === "health" && <HealthView />}
              </>
            )}

            {view?.type === "exercise" && (
              <ExerciseDetailView
                entries={history.filter(h => h.exercise === view.name).sort((a, b) => b.date.localeCompare(a.date))}
                libEx={exercises.find(e => e.name === view.name)}
                onEdit={(id) => pushView({ type: "exercise-edit", id })}
                onCustomize={() => customizeExerciseAndOpenEdit(
                  exercises.find(e => e.name === view.name)
                )}
              />
            )}
            {view?.type === "session" && (
              <SessionDetailView
                session={sessions.find(s => s.id === view.id)}
                entries={history.filter(h => h.workoutId === view.id).sort((a,b) => a.date.localeCompare(b.date))}
                exercises={exercises}
                lastByExercise={lastByExercise}
                settings={profile?.settings || DEFAULT_SETTINGS}
                hasActiveWorkout={!!activeWorkout}
                onUpdate={updateSession}
                onResume={async (id) => {
                  // resumeSession itself sets librarySaveError on conflict
                  // and on Supabase failure; on success it redirects to
                  // the active workout view via setActiveWorkout +
                  // resetView, which unmounts this detail view.
                  await resumeSession(id);
                }}
                onDelete={async (id) => {
                  const ok = await deleteSession(id);
                  if (ok) popView();
                }}
                onCreateExercise={addExerciseToLibrary}
                librarySaveError={librarySaveError}
              />
            )}
            {view?.type === "plan-edit" && (
              <PlanEditView
                plan={view.id ? plans.find(p => p.id === view.id) : null}
                exercises={exercises}
                lastByExercise={lastByExercise}
                defaultUnit={profile?.settings?.defaultUnit || "lb"}
                saveError={librarySaveError}
                onSave={async (p) => {
                  const ok = await savePlan(p);
                  if (ok) popView();
                }}
                onDelete={async (id) => {
                  const ok = await deletePlan(id);
                  if (ok) popView();
                }}
                onCancel={popView}
                onCreateExercise={addExerciseToLibrary}
              />
            )}
            {view?.type === "library" && (
              <LibraryView exercises={exercises} lastByExercise={lastByExercise} onCreate={() => pushView({ type: "exercise-edit", id: null })} onEdit={(id) => pushView({ type: "exercise-edit", id })} onSelect={(name) => pushView({ type: "exercise", name })} />
            )}
            {view?.type === "exercise-edit" && (
              // key forces a fresh mount when view.id changes, so useState
              // initializers re-run with the new exercise's values. Matters
              // for the Customize flow (pop public + push new private in
              // one batch) where the same component instance would otherwise
              // hold stale draft state from the public read-only view.
              <ExerciseEditView
                key={view.id || "new"}
                exercise={view.id ? exercises.find(e => e.id === view.id) : null}
                initialName={view.initialName}
                defaultUnit={profile?.settings?.defaultUnit || "lb"}
                saveError={librarySaveError}
                onSave={async (ex) => {
                  let ok;
                  if (ex.id) ok = await updateExerciseInLibrary(ex.id, ex);
                  else ok = !!(await addExerciseToLibrary(ex));
                  if (ok) popView();
                }}
                onDelete={async (id) => {
                  const ok = await deleteExerciseFromLibrary(id);
                  if (ok) popView();
                }}
                onCustomize={() => customizeExerciseAndOpenEdit(
                  // Look the source up at click-time so a stale closure
                  // doesn't insert a copy of yesterday's row.
                  exercises.find(e => e.id === view.id)
                )}
                onCancel={popView}
              />
            )}
            {view?.type === "profile" && (
              <ProfileView
                profile={profile}
                sessions={sessions}
                history={history}
                exercises={exercises}
                onEdit={() => pushView({ type: "profile-edit" })}
                onOpenSettings={() => pushView({ type: "settings" })}
              />
            )}
            {view?.type === "profile-edit" && (
              <ProfileEditView
                profile={profile}
                saveError={profileSaveError}
                onSave={async (p) => {
                  const ok = await updateProfile(p);
                  if (ok) popView();
                  // On failure the form stays open and saveError renders inline.
                }}
                onCancel={() => { setProfileSaveError(null); popView(); }}
              />
            )}
            {view?.type === "settings" && (
              <SettingsView
                settings={profile?.settings || DEFAULT_SETTINGS}
                onChange={updateSettings}
                onDeleteAccount={() => pushView({ type: "delete-account" })}
                saveError={profileSaveError}
              />
            )}
            {view?.type === "delete-account" && (
              <DeleteAccountView
                email={profile?.email || session?.user?.email || ""}
                onCancel={popView}
                onDelete={deleteAccount}
                deleteError={librarySaveError}
              />
            )}
          </>
        )}

        <BottomDock
          showTabBar={!showWorkoutView && !renderingDetail}
          showMinimizedBar={!!activeWorkout && activeWorkout.minimized}
          tab={tab}
          onTabChange={(t) => { setTab(t); resetView(); }}
          workout={activeWorkout}
          onResume={resumeWorkout}
        />
      </div>
      )}
    </div>
    </>
  );
}

// --- HEADER ---
function Header({ tab, view, activeWorkout, profile, onBack, onCancelWorkout, onMinimizeWorkout, onOpenProfile }) {
  const inWorkoutView = !!activeWorkout && !activeWorkout.minimized;
  const titleMap = { home: "Spotter", past: "Past Workouts", plans: "Workout Plans", health: "Health" };
  let label = new Date().toLocaleDateString("en-US", { weekday: "long" });
  let title = titleMap[tab];
  let titleClass = "serif";

  if (view?.type === "exercise") { title = view.name; titleClass = ""; }
  if (view?.type === "session") { title = "Session"; titleClass = "serif"; }
  if (view?.type === "plan-edit") { title = view.id ? "Edit Plan" : "New Plan"; titleClass = "serif"; }
  if (view?.type === "library") { title = "Exercise Library"; titleClass = "serif"; }
  if (view?.type === "exercise-edit") { title = view.id ? "Edit Exercise" : "New Exercise"; titleClass = "serif"; }
  if (view?.type === "profile") { title = "Profile"; titleClass = "serif"; }
  if (view?.type === "profile-edit") { title = "Edit Profile"; titleClass = "serif"; }
  if (view?.type === "settings") { title = "Settings"; titleClass = "serif"; }
  if (view?.type === "delete-account") { title = "Delete Account"; titleClass = "serif"; }
  // Workout view overrides whatever else might be in view — when foregrounded
  // the header always shows the active-session timer.
  if (inWorkoutView) { label = "Active Session"; title = <WorkoutTimer startedAt={activeWorkout?.startedAt} />; titleClass = "mono"; }

  const showBack = !!view && !inWorkoutView;
  const showProfileBubble = !inWorkoutView && view?.type !== "profile" && view?.type !== "profile-edit";

  return (
    <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-soft pt-safe" style={{ background: "var(--bar-bg-tinted)" }}>
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
        {showBack && (
          <button onClick={onBack} className="w-9 h-9 -ml-2 flex items-center justify-center text-navy-500 hover:text-navy-900 shrink-0 transition">
            <ChevronLeft size={22} />
          </button>
        )}
        {inWorkoutView && (
          <button onClick={onMinimizeWorkout} aria-label="Minimize workout" className="w-9 h-9 -ml-2 flex items-center justify-center text-navy-500 hover:text-navy-900 shrink-0 transition">
            <ChevronDown size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium">{label}</div>
          <h1 className={`text-[26px] font-semibold tracking-tight mt-0.5 truncate text-navy-900 ${titleClass}`} style={{ fontWeight: titleClass === "serif" ? 500 : 600 }}>
            {title}
          </h1>
        </div>
        {inWorkoutView && (
          <button onClick={onCancelWorkout} className="text-xs uppercase tracking-wider text-navy-500 hover:text-red-600 shrink-0 mono">cancel</button>
        )}
        {showProfileBubble && profile && (
          <ProfileBubble profile={profile} onClick={onOpenProfile} />
        )}
      </div>
    </div>
  );
}

function ProfileBubble({ profile, onClick }) {
  const initials = useMemo(() => {
    if (!profile.name) return "?";
    return profile.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  }, [profile.name]);

  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full shrink-0 overflow-hidden border-2 transition active:scale-95 flex items-center justify-center text-white font-semibold text-sm card-shadow"
      style={{
        background: profile.photo ? "transparent" : "var(--avatar-bg)",
        borderColor: "var(--surface)",
        boxShadow: "var(--avatar-shadow)",
      }}
      aria-label="Open profile"
    >
      {profile.photo ? (
        <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
      ) : (
        <span className="mono">{initials}</span>
      )}
    </button>
  );
}

function WorkoutTimer({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (!startedAt) return null;
  return <span className="mono">{formatDuration(now - new Date(startedAt).getTime())}</span>;
}

// --- TAB BAR ---
function TabBar({ tab, onChange }) {
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "past", icon: History, label: "Past" },
    { id: "plans", icon: ListChecks, label: "Plans" },
    { id: "health", icon: Heart, label: "Health" },
  ];
  return (
    <div className="backdrop-blur-xl border-t border-soft px-2 pb-safe" style={{ background: "var(--bar-bg)" }}>
      <div className="flex items-center justify-around py-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition"
              style={{ color: active ? "var(--navy-900)" : "var(--navy-400)" }}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span className={`text-[10px] tracking-wider ${active ? "font-semibold" : "font-medium"}`} style={{ fontFamily: "Inter" }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Always-visible pill that surfaces an active workout while the user is
// browsing other parts of the app. Tap to resume the full workout view.
function MinimizedWorkoutBar({ workout, onResume }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const elapsed = workout.startedAt ? formatDuration(now - new Date(workout.startedAt).getTime()) : "0:00";
  // currentExerciseName is the exercise the user was viewing when they
  // minimized (or last navigated to). Falls back to the last exercise when
  // the field is missing (legacy in-flight workouts persisted before this
  // tracking landed) or when the named exercise was since removed.
  const exercises = workout.exercises || [];
  const currentName = workout.currentExerciseName;
  const activeName = (currentName && exercises.find(e => e.exercise === currentName)?.exercise)
    || exercises[exercises.length - 1]?.exercise
    || "Workout";

  return (
    <div className="px-3 pt-2 pb-1">
      <button
        onClick={onResume}
        className="w-full rounded-xl px-4 py-2.5 flex items-center gap-3 transition active:scale-[0.99] navy-shadow"
        style={{ background: "var(--hero-bg)" }}
        aria-label="Resume workout"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--success)" }} />
          <span className="text-[10px] uppercase tracking-[0.18em] mono font-medium text-white/70">Active</span>
        </div>
        <div className="flex-1 min-w-0 text-left text-white truncate">
          <span className="serif text-sm" style={{ fontWeight: 500 }}>{activeName}</span>
          <span className="text-white/60 mono text-xs ml-1.5">· {elapsed}</span>
        </div>
        <ChevronUp size={16} className="text-white/60 shrink-0" />
      </button>
    </div>
  );
}

// Container at the bottom of the viewport that stacks the minimized workout
// bar (when a workout is in flight and minimized) above the tab bar (when
// not in a detail view). Either, both, or neither may render. When the
// minimized bar is the only child, the dock absorbs the safe-area inset
// itself; otherwise the tab bar handles it.
function BottomDock({ showTabBar, showMinimizedBar, tab, onTabChange, workout, onResume }) {
  if (!showTabBar && !showMinimizedBar) return null;
  const minimizedOnly = showMinimizedBar && !showTabBar;
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-20 ${minimizedOnly ? "pb-safe" : ""}`}>
      <div className="max-w-md mx-auto">
        {showMinimizedBar && <MinimizedWorkoutBar workout={workout} onResume={onResume} />}
        {showTabBar && <TabBar tab={tab} onChange={onTabChange} />}
      </div>
    </div>
  );
}

// --- HOME ---
function HomeView({ recentSessions, recentExercisesList, sessions, history, plans, exercises, profile, activeWorkout, onStartBlank, onStartFromPlan, onResume, onSelectExercise, onSelectSession, onOpenLibrary, onOpenProfileEdit }) {
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // This week — Monday 00:00 local through Sunday 23:59. Counts sessions
  // whose startedAt falls inside that window.
  const workoutsThisWeek = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const offset = day === 0 ? -6 : 1 - day; // Sunday rolls back to last Monday
    d.setDate(d.getDate() + offset);
    const weekStart = d.getTime();
    return (sessions || []).filter(s => new Date(s.startedAt).getTime() >= weekStart).length;
  }, [sessions]);

  const weeklyGoal = profile?.weeklyWorkoutGoal ?? null;

  // Pills: exercises whose most-recent entry has earned a level-up.
  // Hoisted above monthStats because the stat math also needs to look up
  // each entry's tracking mode.
  const libByName = useMemo(() => {
    const m = new Map();
    (exercises || []).forEach(e => m.set(e.name, e));
    return m;
  }, [exercises]);

  // This month — total volume / sets / reps for entries dated within the
  // current calendar month. Volume converts each entry's value to the
  // user's preferred unit before summing (mixed lb/kg histories have to
  // be normalized) and skips bodyweight (weight 0/null) entries. Time-
  // tracked entries (planks, hangs) count toward sets but contribute zero
  // to reps and volume — the numbers in their reps array are seconds,
  // not reps, so summing them would inflate both stats.
  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const targetUnit = profile?.units === "metric" ? "kg" : "lb";
    let volume = 0;
    let sets = 0;
    let reps = 0;
    (history || []).forEach(entry => {
      if (new Date(entry.date).getTime() < monthStart) return;
      sets += entry.reps.length;
      if (isTimeTracked(libByName.get(entry.exercise))) return;
      const entryReps = entry.reps.reduce((a, b) => a + b, 0);
      reps += entryReps;
      if (!entry.weight || entry.weight <= 0) return;
      let weight = entry.weight;
      if (entry.unit !== targetUnit) {
        weight = entry.unit === "kg" ? weight * 2.205 : weight / 2.205;
      }
      volume += weight * entryReps;
    });
    return { volume: Math.round(volume), sets, reps, unit: targetUnit };
  }, [history, profile?.units, libByName]);
  const readyToBump = useMemo(
    () => (recentExercisesList || []).filter(e => getProgressionStatus(e, libByName.get(e.exercise))?.status === "bump"),
    [recentExercisesList, libByName]
  );

  return (
    <div className="px-5 pb-28">
      {/* Hero greeting */}
      <div className="mt-7">
        <div className="text-[11px] uppercase tracking-[0.2em] text-navy-400 mono font-medium">{greeting}</div>
        <div className="serif text-[28px] leading-tight text-navy-900 mt-1" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>
          Let's get to <em style={{ fontStyle: "italic" }}>work.</em>
        </div>
      </div>

      {/* Hero start button — switches to "Resume Workout" while a workout is
          minimized so we never accidentally start a second one over the top. */}
      <button
        onClick={() => {
          if (activeWorkout) onResume();
          else if (plans.length > 0) setShowPlanPicker(true);
          else onStartBlank();
        }}
        className="mt-5 w-full bg-navy-900 text-white py-6 rounded-3xl font-semibold text-base flex items-center justify-center gap-2.5 navy-shadow active:scale-[0.98] transition"
        style={{ background: "var(--primary)" }}
      >
        <Play size={20} strokeWidth={2.5} fill="currentColor" />
        {activeWorkout ? "Resume Workout" : "Start Workout"}
      </button>

      {showPlanPicker && (
        <div className="fixed inset-0 z-30 bg-navy-900/30 backdrop-blur-sm flex items-end justify-center" style={{ background: "var(--modal-overlay)" }} onClick={() => setShowPlanPicker(false)}>
          <div className="max-w-md w-full surface border-t border-soft rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-strong)" }} />
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium mb-3">Choose a plan</div>
            <div className="space-y-2">
              <button onClick={() => { setShowPlanPicker(false); onStartBlank(); }} className="w-full surface-2 border border-soft rounded-2xl p-4 text-left hover:bg-navy-50 transition">
                <div className="font-semibold text-navy-900">Blank workout</div>
                <div className="text-xs text-navy-500 mt-0.5">Build it as you go</div>
              </button>
              {plans.map(plan => (
                <button key={plan.id} onClick={() => { setShowPlanPicker(false); onStartFromPlan(plan); }} className="w-full surface-2 border border-soft rounded-2xl p-4 text-left hover:bg-navy-50 transition">
                  <div className="font-semibold text-navy-900">{plan.name}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{plan.exercises.length} exercises · {plan.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* This week */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">This week</div>
        <div className="surface border border-soft card-shadow rounded-2xl p-5">
          <div className="flex items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold mono text-navy-900">{workoutsThisWeek}</span>
                {weeklyGoal != null && (
                  <span className="text-base mono text-navy-400">of {weeklyGoal}</span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mt-1">Workouts</div>
            </div>
            {weeklyGoal != null && (
              // flex-wrap + justify-end so a streak that overflows the
              // card width breaks onto a second row beneath the navy
              // dots rather than getting clipped or squeezing the count.
              <div className="flex flex-wrap items-center justify-end gap-2" aria-hidden="true">
                {Array.from({ length: weeklyGoal }).map((_, i) => {
                  const done = i < workoutsThisWeek;
                  return (
                    <span
                      key={`g-${i}`}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: done ? "var(--primary)" : "transparent",
                        border: done ? "none" : "2px solid var(--border-strong)",
                      }}
                    />
                  );
                })}
                {workoutsThisWeek > weeklyGoal &&
                  Array.from({ length: workoutsThisWeek - weeklyGoal }).map((_, i) => (
                    <span
                      key={`b-${i}`}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "var(--success)" }}
                    />
                  ))}
              </div>
            )}
          </div>
          {weeklyGoal == null && (
            <button
              onClick={onOpenProfileEdit}
              className="mt-3 text-xs text-navy-400 hover:text-navy-700 transition"
            >
              Set a weekly goal in your profile →
            </button>
          )}
        </div>
      </div>

      {/* This month — visibility per-stat is user-configurable in Settings.
          Hidden stats render "—" instead of the number so the layout stays
          stable as toggles flip; calculations keep running so toggling back
          on shows the live value immediately. */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">This month</div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Volume" value={(profile?.settings?.visibleHomeStats?.volume ?? true) ? monthStats.volume.toLocaleString() : "—"} unit={(profile?.settings?.visibleHomeStats?.volume ?? true) ? monthStats.unit : null} />
          <StatTile label="Sets" value={(profile?.settings?.visibleHomeStats?.sets ?? true) ? monthStats.sets.toLocaleString() : "—"} unit={null} />
          <StatTile label="Reps" value={(profile?.settings?.visibleHomeStats?.reps ?? true) ? monthStats.reps.toLocaleString() : "—"} unit={null} />
        </div>
      </div>

      {/* Ready to level up — compact, horizontally scrolling. Hidden when
          the user has level-up alerts disabled in Settings. The
          progression math underneath still runs; we just suppress the UI. */}
      {readyToBump.length > 0 && (profile?.settings?.showLevelUpAlerts ?? true) && (
        <div className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Ready to level up</div>
          <div className="relative -mx-5">
            <div className="flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
              {readyToBump.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => onSelectExercise && onSelectExercise(entry.exercise)}
                  className="shrink-0 surface-2 border border-soft rounded-xl py-2 pl-3 pr-3 flex items-center gap-1.5 text-xs hover:bg-navy-50 transition"
                  style={{ borderLeftWidth: "3px", borderLeftColor: "var(--accent)" }}
                >
                  <Dumbbell size={12} className="text-navy-700 shrink-0" />
                  <span className="text-navy-900 font-medium whitespace-nowrap">{entry.exercise}</span>
                  <ArrowUp size={12} style={{ color: "var(--accent)" }} className="shrink-0" />
                </button>
              ))}
            </div>
            {/* Soft right-edge fade so the row reads as scrollable when it overflows. */}
            <div
              className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none"
              style={{ background: "linear-gradient(to right, transparent, var(--bg))" }}
            />
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="mt-8 flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">Recent workouts</div>
        <button onClick={onOpenLibrary} className="text-[10px] uppercase tracking-wider text-navy-500 hover:text-navy-900 mono flex items-center gap-1 transition">
          <Library size={11} /> Library
        </button>
      </div>
      <div className="space-y-2">
        {recentSessions.slice(0, 5).map(session => {
          const entries = history.filter(h => h.workoutId === session.id);
          const duration = Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 60000);
          const totalSets = entries.reduce((acc, e) => acc + e.reps.length, 0);
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className="w-full surface border border-soft card-shadow rounded-2xl p-4 flex items-center gap-3 hover:bg-navy-50 transition group text-left"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
                <Dumbbell size={17} className="text-navy-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-navy-900 truncate">{session.name}</div>
                  <div className="text-[11px] text-navy-400 mono shrink-0">{formatDate(session.startedAt)}</div>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-navy-500 mono">
                  <span>{entries.length} ex</span>
                  <span style={{ color: "var(--navy-200)" }}>·</span>
                  <span>{totalSets} sets</span>
                  <span style={{ color: "var(--navy-200)" }}>·</span>
                  <span>{duration}m</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-navy-300 group-hover:text-navy-700 shrink-0 transition" />
            </button>
          );
        })}
      </div>

      <button
        onClick={onOpenLibrary}
        className="mt-4 w-full surface-2 border border-soft text-navy-700 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-navy-50 transition"
      >
        <Library size={14} /> Manage exercise library
      </button>
    </div>
  );
}

// --- LIBRARY ---
function LibraryView({ exercises, lastByExercise, onCreate, onEdit, onSelect }) {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState(null);

  const filtered = useMemo(() => {
    return exercises.filter(ex => {
      const matchesSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = !muscleFilter || ex.muscle === muscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, muscleFilter]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(ex => {
      const key = ex.muscle || "Other";
      if (!g[key]) g[key] = [];
      g[key].push(ex);
    });
    return g;
  }, [filtered]);

  const noMatch = search && filtered.length === 0;

  return (
    <div className="px-5 pb-28">
      <div className="mt-5 relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="w-full surface border border-soft rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-strong text-navy-900"
        />
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto -mx-5 px-5 scrollbar-hide">
        <FilterChip active={!muscleFilter} onClick={() => setMuscleFilter(null)}>All</FilterChip>
        {MUSCLE_GROUPS.filter(m => exercises.some(e => e.muscle === m)).map(m => (
          <FilterChip key={m} active={muscleFilter === m} onClick={() => setMuscleFilter(m)}>{m}</FilterChip>
        ))}
      </div>

      {noMatch && (
        <button
          onClick={() => onCreate({ initialName: search })}
          className="mt-4 w-full rounded-2xl p-4 flex items-center gap-3 transition text-left border"
          style={{
            background: "linear-gradient(135deg, var(--navy-50) 0%, var(--surface) 100%)",
            borderColor: "var(--navy-200)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-100)" }}>
            <Plus size={18} className="text-navy-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy-900">Create "{search}"</div>
            <div className="text-xs text-navy-500 mt-0.5">Add to your exercise library</div>
          </div>
        </button>
      )}

      {!noMatch && Object.entries(grouped).map(([muscle, list]) => (
        <div key={muscle} className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">{muscle}</div>
          <div className="space-y-1.5">
            {list.map(ex => {
              const last = lastByExercise.get(ex.name);
              return (
                <div key={ex.id} className="surface border border-soft rounded-xl flex items-center gap-2 group transition hover:bg-navy-50">
                  <button onClick={() => onSelect(ex.name)} className="flex-1 text-left p-3.5 min-w-0">
                    <div className="font-medium text-navy-900 truncate">{ex.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-navy-500 mono">
                      <span>{ex.targetReps[0]}–{ex.targetReps[1]} {isTimeTracked(ex) ? "sec" : "reps"}</span>
                      <span style={{ color: "var(--navy-200)" }}>·</span>
                      <span>{tracksWeightFor(ex) ? `+${ex.increment ?? 5}${ex.unit}` : "bodyweight"}</span>
                      {ex.equipment && <><span style={{ color: "var(--navy-200)" }}>·</span><span>{ex.equipment}</span></>}
                      {last && <><span style={{ color: "var(--navy-200)" }}>·</span><span>last {formatDate(last.date)}</span></>}
                    </div>
                  </button>
                  <button onClick={() => onEdit(ex.id)} className="p-3 text-navy-300 hover:text-navy-700 shrink-0 transition">
                    <Edit3 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={onCreate}
        className="fixed bottom-20 right-5 z-10 w-14 h-14 rounded-full bg-navy-900 text-white flex items-center justify-center navy-shadow hover:scale-105 active:scale-95 transition"
        style={{ background: "var(--primary)" }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
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

// --- EXERCISE EDIT ---
function ExerciseEditView({ exercise, initialName, defaultUnit = "lb", saveError, onSave, onDelete, onCustomize, onCancel }) {
  const [name, setName] = useState(exercise?.name || initialName || "");
  const [muscle, setMuscle] = useState(exercise?.muscle || "Chest");
  const [equipment, setEquipment] = useState(exercise?.equipment || "Barbell");
  const [minReps, setMinReps] = useState(exercise?.targetReps[0] ?? 8);
  const [maxReps, setMaxReps] = useState(exercise?.targetReps[1] ?? 12);
  // For new exercises, fall back to the user's settings.defaultUnit (lb/kg).
  // Existing exercises keep their saved unit; this only affects creates.
  const [unit, setUnit] = useState(exercise?.unit || defaultUnit);
  const [tracksWeight, setTracksWeight] = useState(exercise ? exercise.tracksWeight !== false : true);
  const [trackingMode, setTrackingMode] = useState(exercise?.trackingMode === "time" ? "time" : "reps");
  const [bumpRule, setBumpRule] = useState(exercise?.bumpRule || "all");
  const [increment, setIncrement] = useState(exercise?.increment ?? 5);
  // Async guard: Customize hits Supabase to insert a private copy and
  // then navigates to the new edit view. Disable the button while the
  // round-trip is in flight so a double-tap doesn't fire two inserts.
  const [customizing, setCustomizing] = useState(false);

  // Public catalog rows are read-only — RLS rejects edits from non-owners.
  // The form still renders normally so the user can review the defaults,
  // but inputs are disabled and Save is replaced by Customize.
  const readOnly = exercise?.visibility === "public";
  const isTime = trackingMode === "time";
  // "rep range" wording reused for both modes — only the trailing noun
  // changes ("reps" vs "seconds"). Form-level validation is identical.
  const targetNoun = isTime ? "seconds" : "reps";
  const canSave = name.trim() && minReps > 0 && maxReps >= minReps && (!tracksWeight || increment > 0);

  const ruleDescription = {
    all: `every set hits ${maxReps}+ ${targetNoun}`,
    majority: `most sets hit ${maxReps}+ ${targetNoun}`,
    any: `any one set hits ${maxReps}+ ${targetNoun}`,
  }[bumpRule];

  return (
    <div className="px-5 pb-32">
      {saveError && (
        <div
          className="mt-5 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
          style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
        >
          {saveError}
        </div>
      )}
      {/* fieldset[disabled] cascades the disabled state to every form
          control inside, which is exactly the read-only behavior we want
          for public catalog exercises. min-w-0 + reset border/padding
          keep the visual layout identical to the original wrapping div. */}
      <fieldset disabled={readOnly} className="mt-5 space-y-4 min-w-0 border-0 p-0 m-0" style={{ opacity: readOnly ? 0.85 : 1 }}>
        <Field label="Exercise name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Romanian Deadlift" autoFocus={!exercise && !readOnly} className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Muscle group">
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map(m => (
              <FilterChip key={m} active={muscle === m} onClick={() => setMuscle(m)}>{m}</FilterChip>
            ))}
          </div>
        </Field>

        <Field label="Equipment">
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_TYPES.map(e => (
              <FilterChip key={e} active={equipment === e} onClick={() => setEquipment(e)}>{e}</FilterChip>
            ))}
          </div>
        </Field>

        <Field label="Tracking mode" hint="Time-tracked exercises log seconds per set instead of reps. Stats math skips them for volume/reps but still counts the sets.">
          <div className="flex gap-1.5">
            <FilterChip active={!isTime} onClick={() => setTrackingMode("reps")}>Reps</FilterChip>
            <FilterChip active={isTime} onClick={() => setTrackingMode("time")}>Time</FilterChip>
          </div>
        </Field>

        <Field label={isTime ? "Target time range" : "Target rep range"}>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" value={minReps || ""} onChange={e => setMinReps(parseInt(e.target.value) || 0)} onFocus={focusToEnd} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
            <span className="text-navy-400">–</span>
            <input type="number" inputMode="numeric" value={maxReps || ""} onChange={e => setMaxReps(parseInt(e.target.value) || 0)} onFocus={focusToEnd} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
            <span className="text-sm text-navy-500">{targetNoun}</span>
          </div>
        </Field>

        <Field label="Unit">
          <div className="flex gap-1.5">
            <FilterChip active={unit === "lb"} onClick={() => setUnit("lb")}>lb</FilterChip>
            <FilterChip active={unit === "kg"} onClick={() => setUnit("kg")}>kg</FilterChip>
          </div>
        </Field>

        <Field label="Weight" hint="Bodyweight exercises track reps only — you can add a vest weight any time during a workout.">
          <div className="flex gap-1.5">
            <FilterChip active={tracksWeight} onClick={() => setTracksWeight(true)}>Uses weight</FilterChip>
            <FilterChip active={!tracksWeight} onClick={() => setTracksWeight(false)}>Bodyweight</FilterChip>
          </div>
        </Field>

        {/* --- Progression rule section, visually grouped --- */}
        <div className="pt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Progression rule</div>
          <div className="surface border border-soft card-shadow rounded-2xl p-4 space-y-4">
            <div>
              <div className="text-xs font-semibold text-navy-900 mb-2">Suggest bumping when…</div>
              <div className="space-y-1.5">
                <RadioRow
                  label="Every set hits the top"
                  hint="Most conservative · best for compounds (bench, squat, deadlift)"
                  active={bumpRule === "all"}
                  onClick={() => setBumpRule("all")}
                />
                <RadioRow
                  label="Most sets hit the top"
                  hint="Balanced · good for most lifts"
                  active={bumpRule === "majority"}
                  onClick={() => setBumpRule("majority")}
                />
                <RadioRow
                  label="Any single set hits the top"
                  hint="Aggressive · best for isolation work (curls, raises)"
                  active={bumpRule === "any"}
                  onClick={() => setBumpRule("any")}
                />
              </div>
            </div>

            {tracksWeight && (
              <div className="border-t border-soft pt-4">
                <div className="text-xs font-semibold text-navy-900 mb-2">Weight increment</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIncrement(Math.max(0.5, Math.round((increment - 0.5) * 2) / 2))} className="w-10 h-10 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={increment || ""}
                    onChange={e => setIncrement(parseFloat(e.target.value) || 0)}
                    onFocus={focusToEnd}
                    className="w-24 surface border border-soft rounded-xl px-3 py-2.5 text-center text-base mono font-semibold focus:outline-none focus:border-strong text-navy-900"
                  />
                  <button onClick={() => setIncrement(Math.round((increment + 0.5) * 2) / 2)} className="w-10 h-10 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
                    <Plus size={14} />
                  </button>
                  <span className="text-sm text-navy-500 mono ml-1">{unit}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[2.5, 5, 10].map(val => (
                    <FilterChip key={val} active={increment === val} onClick={() => setIncrement(val)}>{val} {unit}</FilterChip>
                  ))}
                </div>
              </div>
            )}

            {/* Live preview */}
            <div className="border-t border-soft pt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium mb-1.5">In plain English</div>
              <div className="text-xs text-navy-700 leading-relaxed">
                {tracksWeight ? (
                  <>When <span className="font-semibold">{ruleDescription}</span>, the app will suggest going up by{" "}
                  <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{increment} {unit}</span>.</>
                ) : (
                  <>When <span className="font-semibold">{ruleDescription}</span>, the app will nudge you to push past{" "}
                  <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{maxReps} {targetNoun}</span> next session.</>
                )}
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      {exercise && !readOnly && (
        <button onClick={() => onDelete(exercise.id)} className="mt-8 w-full text-red-600 hover:text-red-700 py-3 text-sm font-medium flex items-center justify-center gap-2">
          <Trash2 size={14} /> Delete exercise
        </button>
      )}

      {readOnly && (
        <div className="mt-8 surface-2 border border-soft rounded-xl p-4 text-xs text-navy-600 leading-relaxed">
          This is part of Spotter's catalog. To change the defaults, customize a copy you own.
        </div>
      )}

      <BottomBar>
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
        {readOnly ? (
          <button
            onClick={async () => {
              if (customizing) return;
              setCustomizing(true);
              try { await onCustomize?.(); } finally { setCustomizing(false); }
            }}
            disabled={customizing}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60 transition"
            style={{ background: "var(--primary)" }}
          >
            {customizing ? "Customizing…" : "Customize"}
          </button>
        ) : (
          <button
            onClick={() => canSave && onSave({ id: exercise?.id, name: name.trim(), muscle, equipment, targetReps: [minReps, maxReps], unit, tracksWeight, trackingMode, bumpRule, increment })}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition"
            style={{ background: "var(--primary)" }}
          >
            Save
          </button>
        )}
      </BottomBar>
    </div>
  );
}

// Modal-over-sheet wrapper for ExerciseEditView. Used when the user opts to
// create a new exercise from the in-workout or in-plan search sheet — sits at
// a higher z-index than the search sheet (z-30) so it stacks above and can
// dismiss back to it cleanly. Renders its own mini-header since it's outside
// the routed Header's nav stack.
function ExerciseEditModal({ initialName, defaultUnit, saveError, onSave, onCancel }) {
  const displayName = (initialName || "").trim() || "Untitled";
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-md mx-auto min-h-full">
        <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-soft pt-safe" style={{ background: "var(--bar-bg-tinted)" }}>
          <div className="px-5 pt-5 pb-4 flex items-center gap-3">
            <button onClick={onCancel} className="w-9 h-9 -ml-2 flex items-center justify-center text-navy-500 hover:text-navy-900 shrink-0 transition" aria-label="Cancel">
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium">New exercise</div>
              <h1 className="serif text-[26px] tracking-tight mt-0.5 truncate text-navy-900" style={{ fontWeight: 500 }}>
                {displayName}
              </h1>
            </div>
          </div>
        </div>
        <ExerciseEditView
          initialName={initialName}
          defaultUnit={defaultUnit}
          saveError={saveError}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

function RadioRow({ label, hint, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-xl border transition text-left flex items-start gap-3"
      style={{
        background: active ? "var(--navy-50)" : "var(--surface-2)",
        borderColor: active ? "var(--navy-600)" : "var(--border)",
      }}
    >
      <div className="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition" style={{
        borderColor: active ? "var(--primary)" : "var(--border-strong)",
        background: active ? "var(--primary)" : "transparent",
      }}>
        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-navy-900">{label}</div>
        <div className="text-[11px] text-navy-500 mt-0.5 leading-relaxed">{hint}</div>
      </div>
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">{label}</div>
      {children}
      {hint && <div className="text-xs text-navy-500 mt-1.5 leading-relaxed">{hint}</div>}
    </div>
  );
}

function BottomBar({ children }) {
  // bottom is offset by --bottom-stack-offset (set on .app-content) so this
  // bar floats above the minimized workout pill in detail views like session
  // edit. Defaults to 0 when no workout is minimized.
  return (
    <div
      className="fixed left-0 right-0 backdrop-blur-xl border-t border-soft"
      style={{ background: "var(--bar-bg)", bottom: "var(--bottom-stack-offset, 0px)" }}
    >
      <div className="max-w-md mx-auto px-5 py-3 flex gap-2">{children}</div>
    </div>
  );
}

// --- PAST WORKOUTS ---
function PastView({ sessions, history, onSelectSession, onGoHome }) {
  const sessionsByMonth = useMemo(() => {
    const groups = {};
    [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).forEach(s => {
      const key = new Date(s.startedAt).toLocaleDateString("en-US", { year: "numeric", month: "long" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [sessions]);

  const totalThisMonth = sessions.filter(s => {
    const d = new Date(s.startedAt); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Real average across logged sessions, or em-dash when there's nothing to
  // average. Was previously a hardcoded "58" placeholder that surfaced as a
  // misleading stat for fresh accounts.
  const avgDurationMin = useMemo(() => {
    if (sessions.length === 0) return null;
    const totalMs = sessions.reduce((acc, s) => {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.endedAt).getTime();
      return acc + Math.max(0, end - start);
    }, 0);
    return Math.round(totalMs / sessions.length / 60000);
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="px-5 pb-28">
        <div className="mt-20 flex flex-col items-center text-center">
          <Dumbbell size={32} className="text-navy-300 mb-4" />
          <h2 className="serif text-navy-900 text-xl mb-2" style={{ fontWeight: 500 }}>No workouts yet</h2>
          <p className="text-sm text-navy-500 max-w-xs leading-relaxed">
            Your training history will show up here. Tap Start Workout on Home to log your first one.
          </p>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="mt-5 text-sm font-medium text-navy-700 hover:text-navy-900 underline-offset-2 hover:underline transition"
            >
              Start a workout
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-28">
      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatTile label="This month" value={totalThisMonth} unit="sessions" />
        <StatTile label="Total" value={sessions.length} unit="sessions" />
        <StatTile label="Avg duration" value={avgDurationMin ?? "—"} unit={avgDurationMin == null ? null : "min"} />
      </div>

      {Object.entries(sessionsByMonth).map(([month, list]) => (
        <div key={month} className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">{month}</div>
          <div className="space-y-2">
            {list.map(session => {
              const entries = history.filter(h => h.workoutId === session.id);
              const duration = Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 60000);
              const totalSets = entries.reduce((acc, e) => acc + e.reps.length, 0);
              return (
                <button key={session.id} onClick={() => onSelectSession(session.id)} className="w-full surface border border-soft card-shadow rounded-2xl p-4 flex items-center gap-3 transition group text-left hover:bg-navy-50">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
                    <Dumbbell size={17} className="text-navy-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-navy-900 truncate">{session.name}</div>
                      <div className="text-[11px] text-navy-400 mono shrink-0">{formatDate(session.startedAt)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-navy-500 mono">
                      <span>{entries.length} ex</span>
                      <span style={{ color: "var(--navy-200)" }}>·</span>
                      <span>{totalSets} sets</span>
                      <span style={{ color: "var(--navy-200)" }}>·</span>
                      <span>{duration}m</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-navy-300 group-hover:text-navy-700 shrink-0 transition" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, unit }) {
  return (
    <div className="surface border border-soft card-shadow rounded-xl p-3">
      <div className="text-[9px] uppercase tracking-wider text-navy-500 mono font-medium">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="text-2xl font-semibold mono text-navy-900">{value}</div>
        <div className="text-[10px] text-navy-400 mono">{unit}</div>
      </div>
    </div>
  );
}

function SessionDetailView({ session, entries, exercises, lastByExercise, settings, hasActiveWorkout, onUpdate, onResume, onDelete, onCreateExercise, librarySaveError }) {
  const showLevelUpAlerts = settings?.showLevelUpAlerts ?? true;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(session?.name || "");
  const [draftEntries, setDraftEntries] = useState(entries);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // When non-null, open the full ExerciseEditView modal pre-filled with this name.
  const [pendingNewExerciseName, setPendingNewExerciseName] = useState(null);

  // Reset drafts when session/entries change or when leaving edit mode
  useEffect(() => {
    setDraftName(session?.name || "");
    setDraftEntries(entries);
    setShowPicker(false);
    setPendingNewExerciseName(null);
  }, [session?.id, editing]);

  // Auto-cancel delete confirmation
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  if (!session) return null;
  // endedAt is null for a session that's been resumed and is currently
  // the activeWorkout. Such sessions are filtered out of the past list
  // upstream, so this branch is mostly defensive — but if it ever does
  // render here, show "—" rather than NaN minutes.
  const duration = session.endedAt
    ? Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
    : null;
  const displayEntries = editing ? draftEntries : entries;
  // Time-tracked entries don't contribute to a "Total reps" stat — their
  // numbers are seconds, not reps. Sum reps-mode entries only.
  const totalReps = displayEntries.reduce((acc, e) => {
    if (isTimeTracked(exercises?.find(x => x.name === e.exercise))) return acc;
    return acc + e.reps.reduce((a, b) => a + b, 0);
  }, 0);

  const updateEntry = (entryId, patch) => {
    setDraftEntries(draftEntries.map(e => e.id === entryId ? { ...e, ...patch } : e));
  };

  const updateEntryReps = (entryId, setIdx, value) => {
    setDraftEntries(draftEntries.map(e => {
      if (e.id !== entryId) return e;
      const newReps = [...e.reps];
      newReps[setIdx] = Math.max(0, parseInt(value) || 0);
      return { ...e, reps: newReps };
    }));
  };

  const removeEntrySet = (entryId, setIdx) => {
    setDraftEntries(draftEntries.map(e => {
      if (e.id !== entryId) return e;
      const newReps = e.reps.filter((_, i) => i !== setIdx);
      return { ...e, reps: newReps.length > 0 ? newReps : [0] };
    }));
  };

  const addEntrySet = (entryId) => {
    setDraftEntries(draftEntries.map(e => e.id === entryId ? { ...e, reps: [...e.reps, 0] } : e));
  };

  const removeEntry = (entryId) => {
    setDraftEntries(draftEntries.filter(e => e.id !== entryId));
  };

  // Build a fresh draft entry for an exercise being added retroactively. Uses
  // the session's startedAt as the entry date so it sorts alongside the
  // existing entries; reps starts as [0] (one empty set) so EditableEntry
  // shows a row to fill in. Library lookup gives us the right unit and
  // targetReps; falls back to sensible defaults if the library entry is
  // somehow missing.
  const buildDraftEntry = (exerciseName, libEx) => ({
    id: Date.now(),
    date: session.startedAt,
    exercise: exerciseName,
    weight: 0,
    reps: [0],
    targetReps: libEx?.targetReps || [8, 12],
    unit: libEx?.unit || "lb",
    workoutId: session.id,
  });

  const addExistingExercise = (exerciseName) => {
    const libEx = exercises?.find(e => e.name === exerciseName);
    setDraftEntries([...draftEntries, buildDraftEntry(exerciseName, libEx)]);
    setShowPicker(false);
  };

  // Open the full editor modal pre-filled with the typed name; defer creation
  // until Save. On Save, the new exercise is added to the library AND a new
  // draft entry is appended to the session.
  const handleCreateNewFromPicker = (newName) => setPendingNewExerciseName(newName);
  const handleSaveNewExerciseFromPicker = async (payload) => {
    const created = await onCreateExercise(payload);
    if (!created) return; // librarySaveError surfaces in the modal
    setDraftEntries([...draftEntries, buildDraftEntry(created.name, created)]);
    setPendingNewExerciseName(null);
    setShowPicker(false);
  };

  const handleSave = async () => {
    // Filter out any entries that ended up with no reps (e.g. all sets removed)
    const cleaned = draftEntries
      .map(e => ({ ...e, reps: e.reps.filter(r => r > 0) }))
      .filter(e => e.reps.length > 0);
    const ok = await onUpdate(session.id, { name: draftName.trim() || "Workout" }, cleaned);
    if (ok) setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  return (
    <div className="px-5 pb-32">
      {/* Hero card */}
      <div className="mt-5 rounded-2xl p-5 card-shadow-lg border border-soft" style={{ background: "var(--hero-bg)" }}>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mono font-medium">{formatLongDate(session.startedAt)}</div>
        {editing ? (
          <input
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            placeholder="Workout name"
            className="mt-1 w-full bg-transparent serif text-2xl text-white focus:outline-none"
            style={{
              fontWeight: 500,
              caretColor: "white",
              borderBottom: "2px solid rgba(255,255,255,0.4)",
              paddingBottom: "2px",
            }}
          />
        ) : (
          <div className="serif text-2xl mt-1 text-white" style={{ fontWeight: 500 }}>{session.name}</div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-5">
          <SessionStat label="Duration" value={duration == null ? "—" : `${duration}m`} />
          <SessionStat label="Exercises" value={displayEntries.length} />
          <SessionStat label="Total reps" value={totalReps} />
        </div>
      </div>

      {/* Action bar */}
      {!editing ? (
        <div className="mt-4 space-y-2">
          {/* Resume — primary action. Friction-free (no confirmation):
              users can always finish or discard the resumed workout.
              Disabled and explanatory when an active workout is already
              in flight; the underlying onResume also surfaces that
              guard via librarySaveError, but disabling the button gives
              the user immediate visual feedback. */}
          <button
            onClick={() => !hasActiveWorkout && onResume?.(session.id)}
            disabled={hasActiveWorkout}
            className="w-full text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition"
            style={{ background: "var(--primary)" }}
          >
            <Play size={14} strokeWidth={2.5} fill="currentColor" /> Resume
          </button>
          {hasActiveWorkout && (
            <div className="text-xs text-navy-500 leading-relaxed">
              You have a workout in progress. Finish or discard it before resuming another.
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 surface border border-soft text-navy-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-navy-50 transition"
            >
              <Edit3 size={13} /> Edit
            </button>
            <button
              onClick={async () => {
                if (confirmDelete) await onDelete(session.id);
                else setConfirmDelete(true);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition border"
              style={{
                borderColor: confirmDelete ? "var(--destructive)" : "var(--border)",
                color: confirmDelete ? "var(--destructive)" : "var(--navy-700)",
                background: confirmDelete ? "var(--destructive-bg)" : "var(--surface)",
              }}
            >
              <Trash2 size={13} /> {confirmDelete ? "Tap to confirm" : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 surface-2 border border-soft rounded-xl p-3 text-xs text-navy-600 leading-relaxed">
          You're editing this workout. Changes save when you tap Done.
        </div>
      )}

      {librarySaveError && (
        <div
          className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
          style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
        >
          {librarySaveError}
        </div>
      )}

      {/* Exercises */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Exercises</div>
        <div className="space-y-2">
          {displayEntries.map(entry => {
            const libEx = exercises?.find(e => e.name === entry.exercise);
            const leveledUp = !editing && showLevelUpAlerts && getProgressionStatus(entry, libEx)?.status === "bump";
            const suffix = setUnitSuffix(libEx);
            const formatSets = (reps) => reps.map(r => `${r}${suffix}`).join(" · ");
            return editing ? (
              <EditableEntry
                key={entry.id}
                entry={entry}
                libEx={libEx}
                onWeightChange={(weight) => updateEntry(entry.id, { weight })}
                onRepsChange={(setIdx, value) => updateEntryReps(entry.id, setIdx, value)}
                onNoteChange={(note) => updateEntry(entry.id, { note })}
                onAddSet={() => addEntrySet(entry.id)}
                onRemoveSet={(setIdx) => removeEntrySet(entry.id, setIdx)}
                onRemoveEntry={() => removeEntry(entry.id)}
              />
            ) : (
              <div key={entry.id} className="surface border border-soft card-shadow rounded-xl p-4">
                <div className="font-semibold text-navy-900 mb-2 flex items-center gap-2">
                  <span>{entry.exercise}</span>
                  {leveledUp && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: "var(--accent)" }}
                      aria-label="Earned a level up"
                    />
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  {entry.weight > 0 ? (
                    <>
                      <div className="text-2xl font-semibold mono text-navy-900">{entry.weight}</div>
                      <div className="text-navy-400 text-xs mono">{entry.unit}</div>
                      <div className="text-navy-300 mono">×</div>
                      <div className="text-navy-700 mono text-sm">{formatSets(entry.reps)}</div>
                    </>
                  ) : (
                    <div className="text-2xl font-semibold mono text-navy-900">{formatSets(entry.reps)}</div>
                  )}
                </div>
                {entry.note && <div className="mt-2 text-xs text-navy-500 italic">"{entry.note}"</div>}
              </div>
            );
          })}
          {editing && displayEntries.length === 0 && (
            <div className="surface border border-dashed border-strong rounded-xl p-6 text-center text-sm text-navy-500">
              All exercises removed. The workout will be deleted when you save.
            </div>
          )}
          {editing && (
            <button
              onClick={() => setShowPicker(true)}
              className="w-full surface-2 border border-dashed border-strong text-navy-600 py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-navy-50 transition"
            >
              <Plus size={16} /> Add exercise
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <ExerciseSearchSheet
          exercises={exercises || []}
          lastByExercise={lastByExercise || new Map()}
          onPick={addExistingExercise}
          onCreateNew={handleCreateNewFromPicker}
          onClose={() => setShowPicker(false)}
        />
      )}
      {pendingNewExerciseName !== null && (
        <ExerciseEditModal
          initialName={pendingNewExerciseName}
          defaultUnit={settings?.defaultUnit || "lb"}
          saveError={librarySaveError}
          onSave={handleSaveNewExerciseFromPicker}
          onCancel={() => setPendingNewExerciseName(null)}
        />
      )}

      {/* Save/cancel bar in edit mode */}
      {editing && (
        <BottomBar>
          <button onClick={handleCancelEdit} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">
            Cancel
          </button>
          <button
            onClick={async () => {
              if (draftEntries.filter(e => e.reps.some(r => r > 0)).length === 0) {
                await onDelete(session.id);
              } else {
                await handleSave();
              }
            }}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition"
            style={{ background: "var(--primary)" }}
          >
            Done
          </button>
        </BottomBar>
      )}
    </div>
  );
}

function EditableEntry({ entry, libEx, onWeightChange, onRepsChange, onNoteChange, onAddSet, onRemoveSet, onRemoveEntry }) {
  const setNoun = isTimeTracked(libEx) ? "seconds" : "reps";
  const [showNote, setShowNote] = useState(!!entry.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState(entry.weight > 0 ? String(entry.weight) : "");
  const [showWeightRow, setShowWeightRow] = useState(entry.weight > 0);
  const weightRef = useRef(null);

  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 3000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  useEffect(() => {
    if (editingWeight && weightRef.current) {
      weightRef.current.focus();
      weightRef.current.select();
    }
  }, [editingWeight]);

  const commitWeight = () => {
    const parsed = parseFloat(weightDraft);
    if (!isNaN(parsed) && parsed >= 0) {
      onWeightChange(Math.round(parsed * 10) / 10);
    }
    setEditingWeight(false);
  };

  return (
    <div className="surface border border-soft card-shadow rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-navy-900 truncate">{entry.exercise}</div>
        <button
          onClick={() => {
            if (confirmRemove) onRemoveEntry();
            else setConfirmRemove(true);
          }}
          className="text-xs flex items-center gap-1 transition shrink-0"
          style={{ color: confirmRemove ? "var(--destructive)" : "var(--navy-400)" }}
        >
          <Trash2 size={12} />
          {confirmRemove ? "Confirm" : "Remove"}
        </button>
      </div>

      {/* Weight row */}
      {showWeightRow ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium w-14">Weight</div>
          {editingWeight ? (
            <input
              ref={weightRef}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weightDraft}
              onChange={e => setWeightDraft(e.target.value)}
              onBlur={commitWeight}
              onFocus={focusToEnd}
              onKeyDown={e => {
                if (e.key === "Enter") e.target.blur();
                else if (e.key === "Escape") { setEditingWeight(false); setWeightDraft(entry.weight > 0 ? String(entry.weight) : ""); }
              }}
              className="w-20 surface-2 border border-soft rounded-lg px-2 py-1 text-base font-semibold mono text-center text-navy-900 focus:outline-none focus:border-strong"
            />
          ) : (
            <button
              onClick={() => { setWeightDraft(entry.weight > 0 ? String(entry.weight) : ""); setEditingWeight(true); }}
              className="text-base font-semibold mono text-navy-900 hover:bg-navy-50 px-2 py-1 rounded-lg transition"
            >
              {entry.weight}
            </button>
          )}
          <div className="text-xs text-navy-400 mono">{entry.unit}</div>
        </div>
      ) : (
        <button
          onClick={() => { setShowWeightRow(true); setWeightDraft(""); setEditingWeight(true); }}
          className="mt-3 text-xs text-navy-500 hover:text-navy-900 flex items-center gap-1.5 transition"
        >
          <Plus size={12} /> Add weight
        </button>
      )}

      {/* Sets */}
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Sets</div>
        <div className="space-y-1.5">
          {entry.reps.map((reps, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] mono shrink-0 font-semibold" style={{ background: "var(--navy-50)", color: "var(--navy-600)" }}>
                {i + 1}
              </div>
              <input
                type="number"
                inputMode="numeric"
                value={reps || ""}
                onChange={e => onRepsChange(i, e.target.value)}
                onFocus={focusToEnd}
                placeholder="0"
                className="w-16 surface-2 border border-soft rounded-md px-2 py-1.5 text-sm font-semibold mono text-center text-navy-900 focus:outline-none focus:border-strong"
              />
              <span className="text-xs text-navy-400">{setNoun}</span>
              {entry.reps.length > 1 && (
                <button onClick={() => onRemoveSet(i)} className="ml-auto text-navy-300 hover:text-red-600 p-1 transition">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={onAddSet} className="mt-2 text-xs text-navy-500 hover:text-navy-900 flex items-center gap-1.5 transition">
          <Plus size={12} /> Add set
        </button>
      </div>

      {/* Note */}
      <div className="mt-3">
        {showNote || entry.note ? (
          <textarea
            value={entry.note || ""}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Note..."
            className="w-full surface-2 border border-soft rounded-lg p-2 text-xs text-navy-900 placeholder-navy-300 resize-none focus:outline-none focus:border-strong"
            rows={2}
          />
        ) : (
          <button onClick={() => setShowNote(true)} className="text-xs text-navy-500 hover:text-navy-900 flex items-center gap-1.5 transition">
            <Edit3 size={12} /> Add note
          </button>
        )}
      </div>
    </div>
  );
}

function SessionStat({ label, value }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-white/50 mono font-medium">{label}</div>
      <div className="text-xl font-semibold mono text-white mt-0.5">{value}</div>
    </div>
  );
}

// --- PLANS ---
function PlansView({ plans, onCreate, onEdit, onUse }) {
  if (plans.length === 0) {
    return (
      <div className="px-5 pb-28">
        <div className="mt-20 flex flex-col items-center text-center">
          <ListChecks size={32} className="text-navy-300 mb-4" />
          <h2 className="serif text-navy-900 text-xl mb-2" style={{ fontWeight: 500 }}>No plans yet</h2>
          <p className="text-sm text-navy-500 max-w-xs leading-relaxed mb-6">
            Plans are reusable workout templates — a list of exercises you can launch in a single tap.
          </p>
          <button
            onClick={onCreate}
            className="px-5 py-3 rounded-xl text-white font-semibold text-sm transition"
            style={{ background: "var(--primary)" }}
          >
            Create your first plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-28">
      <button onClick={onCreate} className="mt-5 w-full surface border border-dashed border-strong text-navy-700 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-navy-50 transition">
        <Plus size={16} />
        Create new plan
      </button>

      <div className="mt-6 text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Your plans</div>
      <div className="space-y-2">
        {plans.map(plan => (
          <div key={plan.id} className="surface border border-soft card-shadow rounded-2xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy-900">{plan.name}</div>
                  <div className="text-xs text-navy-500 mt-0.5">{plan.description}</div>
                </div>
                <button onClick={() => onEdit(plan.id)} className="text-navy-400 hover:text-navy-900 shrink-0 p-1 transition">
                  <Edit3 size={14} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {plan.exercises.map((ex, i) => (
                  <span key={i} className="text-[10px] mono px-2 py-1 rounded-md text-navy-700" style={{ background: "var(--navy-100)" }}>{ex}</span>
                ))}
              </div>
            </div>
            <button onClick={() => onUse(plan)} className="w-full border-t border-soft py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition text-navy-900 hover:bg-navy-50" style={{ background: "var(--surface-2)" }}>
              <Play size={12} fill="currentColor" /> Start this workout
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanEditView({ plan, exercises, lastByExercise, defaultUnit, saveError, onSave, onDelete, onCancel, onCreateExercise }) {
  const [name, setName] = useState(plan?.name || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [planExercises, setPlanExercises] = useState(plan?.exercises || []);
  const [showPicker, setShowPicker] = useState(false);
  // When non-null, open the full ExerciseEditView as a modal pre-filled with this name.
  const [pendingNewExerciseName, setPendingNewExerciseName] = useState(null);

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= planExercises.length) return;
    const newList = [...planExercises];
    [newList[idx], newList[target]] = [newList[target], newList[idx]];
    setPlanExercises(newList);
  };

  const remove = (idx) => setPlanExercises(planExercises.filter((_, i) => i !== idx));
  const addExisting = (name) => { setPlanExercises([...planExercises, name]); setShowPicker(false); };
  // Open the editor modal pre-filled with the typed name; defer creation until Save.
  const handleCreateNew = (newName) => setPendingNewExerciseName(newName);
  const handleSaveNewExercise = async (payload) => {
    const created = await onCreateExercise(payload);
    if (!created) return; // librarySaveError surfaces in the modal
    setPlanExercises([...planExercises, created.name]);
    setPendingNewExerciseName(null);
    setShowPicker(false);
  };

  const canSave = name.trim() && planExercises.length > 0;

  return (
    <div className="px-5 pb-32">
      {showPicker && (
        <ExerciseSearchSheet exercises={exercises} lastByExercise={lastByExercise} excluded={planExercises} onPick={addExisting} onCreateNew={handleCreateNew} onClose={() => setShowPicker(false)} />
      )}
      {pendingNewExerciseName !== null && (
        <ExerciseEditModal
          initialName={pendingNewExerciseName}
          defaultUnit={defaultUnit}
          saveError={saveError}
          onSave={handleSaveNewExercise}
          onCancel={() => setPendingNewExerciseName(null)}
        />
      )}

      {saveError && pendingNewExerciseName === null && (
        <div
          className="mt-5 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
          style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
        >
          {saveError}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <Field label="Plan name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day A" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>
        <Field label="Description (optional)">
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Chest, shoulders, triceps" className="w-full surface border border-soft rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-strong text-navy-900" />
        </Field>
      </div>

      <div className="mt-6">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Exercises</div>
        {planExercises.length === 0 ? (
          <div className="surface border border-dashed border-strong rounded-xl p-6 text-center text-sm text-navy-500">
            No exercises yet
          </div>
        ) : (
          <div className="space-y-2">
            {planExercises.map((ex, i) => (
              <div key={`${ex}-${i}`} className="surface border border-soft rounded-xl p-3 flex items-center gap-3">
                <GripVertical size={16} className="text-navy-300 shrink-0" />
                <div className="flex-1 min-w-0 truncate text-navy-900">
                  <span className="text-navy-400 mono text-xs mr-2">{i + 1}.</span>
                  {ex}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button disabled={i === 0} onClick={() => move(i, -1)} className="p-2 text-navy-400 hover:text-navy-900 disabled:opacity-30 transition">
                    <ArrowUp size={14} />
                  </button>
                  <button disabled={i === planExercises.length - 1} onClick={() => move(i, 1)} className="p-2 text-navy-400 hover:text-navy-900 disabled:opacity-30 transition">
                    <ArrowUp size={14} className="rotate-180" />
                  </button>
                  <button onClick={() => remove(i)} className="p-2 text-navy-400 hover:text-red-600 transition">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowPicker(true)} className="mt-2 w-full surface-2 border border-dashed border-strong text-navy-600 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-navy-50 transition">
          <Plus size={14} /> Add exercise
        </button>
      </div>

      {plan && (
        <button onClick={() => onDelete(plan.id)} className="mt-6 w-full text-red-600 hover:text-red-700 py-3 text-sm font-medium flex items-center justify-center gap-2">
          <Trash2 size={14} /> Delete plan
        </button>
      )}

      <BottomBar>
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
        <button onClick={() => canSave && onSave({ id: plan?.id, name, description, exercises: planExercises })} disabled={!canSave} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition" style={{ background: "var(--primary)" }}>
          Save plan
        </button>
      </BottomBar>
    </div>
  );
}

// --- SHARED EXERCISE SEARCH SHEET ---
function ExerciseSearchSheet({ exercises, lastByExercise, excluded = [], onPick, onCreateNew, onClose }) {
  const [search, setSearch] = useState("");
  // iOS Safari and iOS PWAs don't resize the layout viewport when the
  // keyboard opens — bottom:0 fixed/absolute elements stay anchored to
  // the layout viewport's bottom, which is buried behind the keyboard.
  // Track the keyboard height via the visualViewport API and shift the
  // sheet up by that amount so its bottom edge (and the pinned Create
  // row) sit just above the keyboard.
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const filtered = useMemo(() => {
    return exercises
      .filter(e => !excluded.includes(e.name))
      .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search, excluded]);

  const exactMatch = filtered.some(e => e.name.toLowerCase() === search.toLowerCase().trim());
  const showCreate = search.trim().length > 0 && !exactMatch;

  return (
    <div className="fixed inset-0 z-30 backdrop-blur-sm" style={{ background: "var(--modal-overlay)" }} onClick={onClose}>
      <div
        className="absolute inset-x-0 max-w-md mx-auto surface border-t border-soft rounded-t-3xl flex flex-col"
        style={{
          // Shift the sheet up by the keyboard height so its bottom
          // (where the Create row sits) is visible above the keyboard.
          bottom: keyboardOffset,
          // Subtract the keyboard offset from max-height too, otherwise
          // the sheet can still extend off the top of the visible area
          // when the keyboard is open.
          maxHeight: `calc(85vh - ${keyboardOffset}px)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 pb-3 shrink-0">
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-strong)" }} />
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or type a new exercise..."
              className="w-full surface-2 border border-soft rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {filtered.length === 0 && !showCreate && (
            <div className="text-center py-8 text-sm text-navy-500">All exercises already added</div>
          )}

          <div className="space-y-1.5">
            {filtered.map(ex => {
              const last = lastByExercise.get(ex.name);
              return (
                <button key={ex.id} onClick={() => onPick(ex.name)} className="w-full surface-2 hover:bg-navy-50 border border-soft rounded-xl p-3 text-left transition flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-900 truncate">{ex.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-navy-500 mono">
                      {ex.muscle && <span>{ex.muscle}</span>}
                      {last && <><span style={{ color: "var(--navy-200)" }}>·</span><span>{last.weight > 0 ? `${last.weight}${ex.unit} ` : ""}last {formatDate(last.date)}</span></>}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-navy-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Pinned Create row — kept outside the scroll area so the iOS
            keyboard doesn't bury it. Anchoring it to the bottom of the
            sheet means it sits just above the keyboard regardless of how
            many results are listed above. */}
        {showCreate && (
          <div className="shrink-0 px-5 pt-3 pb-5 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => onCreateNew(search.trim())}
              className="w-full rounded-xl p-4 flex items-center gap-3 transition text-left border"
              style={{
                background: "linear-gradient(135deg, var(--navy-50) 0%, var(--surface) 100%)",
                borderColor: "var(--navy-200)",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-100)" }}>
                <Sparkles size={16} className="text-navy-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy-900 truncate">Create "{search.trim()}"</div>
                <div className="text-xs text-navy-500 mt-0.5">Add to your library</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- PROFILE ---
function ProfileView({ profile, sessions, history, exercises, onEdit, onOpenSettings }) {
  const initials = useMemo(() => profile.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(), [profile.name]);

  const memberFor = useMemo(() => {
    if (!profile.memberSince) return null;
    const days = Math.floor((Date.now() - new Date(profile.memberSince).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  }, [profile.memberSince]);

  // Lookup table so each history entry's tracking mode can be resolved
  // when computing reps / volume totals. Time-tracked exercises (planks,
  // hangs) contribute to sets but not to reps or volume.
  const libByName = useMemo(() => {
    const m = new Map();
    (exercises || []).forEach(e => m.set(e.name, e));
    return m;
  }, [exercises]);

  const totalSets = history.reduce((acc, e) => acc + e.reps.length, 0);
  const totalReps = useMemo(
    () => history.reduce((acc, e) => {
      if (isTimeTracked(libByName.get(e.exercise))) return acc;
      return acc + e.reps.reduce((a, b) => a + b, 0);
    }, 0),
    [history, libByName],
  );

  // Total volume = sum of (weight × reps), normalized to the user's preferred unit.
  // Each history entry has its own unit (lb or kg) so we convert before summing.
  // Time-tracked entries are excluded — their reps array holds seconds.
  const totalVolume = useMemo(() => {
    const targetUnit = profile.units === "imperial" ? "lb" : "kg";
    return history.reduce((acc, entry) => {
      if (isTimeTracked(libByName.get(entry.exercise))) return acc;
      const entryReps = entry.reps.reduce((a, b) => a + b, 0);
      let weight = entry.weight;
      if (entry.unit !== targetUnit) {
        weight = entry.unit === "kg" ? weight * 2.205 : weight / 2.205;
      }
      return acc + weight * entryReps;
    }, 0);
  }, [history, profile.units, libByName]);

  // Format volume nicely: 12,450 lb → "12.5k", 1,234,567 → "1.2M"
  const displayVolume = useMemo(() => {
    if (totalVolume >= 1_000_000) return `${(totalVolume / 1_000_000).toFixed(1)}M`;
    if (totalVolume >= 10_000) return `${(totalVolume / 1000).toFixed(1)}k`;
    if (totalVolume >= 1000) return `${(totalVolume / 1000).toFixed(2)}k`;
    return Math.round(totalVolume).toLocaleString();
  }, [totalVolume]);

  // Convert height/weight for display
  const displayHeight = profile.units === "imperial" && profile.heightCm
    ? `${Math.floor(profile.heightCm / 2.54 / 12)}'${Math.round(profile.heightCm / 2.54 % 12)}"`
    : profile.heightCm ? `${profile.heightCm} cm` : "—";
  const displayWeight = profile.units === "imperial" && profile.weightKg
    ? `${Math.round(profile.weightKg * 2.205)} lb`
    : profile.weightKg ? `${profile.weightKg} kg` : "—";

  const [csvFallback, setCsvFallback] = useState(null); // null | { csv, filename }
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const csv = buildCsv(sessions, history, exercises);
    const filename = csvFilename(profile);
    const downloaded = tryDownloadCsv(csv, filename);
    if (!downloaded) {
      setCsvFallback({ csv, filename });
    }
  };

  const handleCopy = async () => {
    if (!csvFallback) return;
    try {
      await navigator.clipboard.writeText(csvFallback.csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="px-5 pb-28">
      {/* Hero card */}
      <div className="mt-5 rounded-2xl p-6 card-shadow-lg" style={{ background: "var(--hero-bg)" }}>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0"
            style={{
              background: profile.photo ? "transparent" : "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            {profile.photo ? (
              <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-white mono">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="serif text-[24px] text-white truncate" style={{ fontWeight: 500, letterSpacing: "-0.01em" }}>
              {profile.name}
            </div>
            <div className="text-xs text-white/60 mt-0.5 truncate">{profile.email}</div>
            {profile.homeGym?.trim() ? (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] uppercase tracking-[0.18em] mono font-medium text-white/50 truncate">
                <Dumbbell size={10} className="shrink-0" />
                <span className="truncate">{profile.homeGym}</span>
              </div>
            ) : memberFor ? (
              <div className="text-[10px] uppercase tracking-[0.18em] mono font-medium text-white/40 mt-2">
                Member · {memberFor}
              </div>
            ) : null}
          </div>
        </div>

        <button
          onClick={onEdit}
          className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
          style={{ background: "rgba(255,255,255,0.12)", color: "white" }}
        >
          <Edit3 size={14} /> Edit profile
        </button>
      </div>

      {/* Vitals — about you */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <ProfileStat label="Workouts" value={sessions.length.toLocaleString()} />
        <ProfileStat label="Height" value={displayHeight} />
        <ProfileStat label="Weight" value={displayWeight} />
      </div>

      {/* Activity — your training, biggest unit to smallest */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ProfileStat label="Total sets" value={totalSets.toLocaleString()} />
        <ProfileStat label="Total reps" value={totalReps.toLocaleString()} />
        <ProfileStat label="Volume" value={displayVolume} unit={profile.units === "imperial" ? "lb" : "kg"} />
      </div>

      {/* Settings entry — sits between identity stats and the About card.
          Same visual weight as the data-export card below. */}
      <div className="mt-7">
        <button
          onClick={onOpenSettings}
          className="w-full surface border border-soft card-shadow rounded-2xl p-4 flex items-center gap-3 hover:bg-navy-50 transition text-left"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
            <Settings size={18} className="text-navy-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy-900">Settings</div>
            <div className="text-xs text-navy-500 mt-0.5">Theme, alerts, defaults, account</div>
          </div>
          <ChevronRight size={16} className="text-navy-300 shrink-0" />
        </button>
      </div>

      {/* Details */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">About</div>
        <div className="surface border border-soft card-shadow rounded-2xl divide-y" style={{ borderColor: "var(--border)" }}>
          <DetailRow icon={Mail} label="Email" value={profile.email} />
          <DetailRow icon={Calendar} label="Date of birth" value={formatDateOfBirth(profile.dateOfBirth)} />
          <DetailRow icon={User} label="Gender" value={profile.gender || "—"} />
          <DetailRow icon={Dumbbell} label="Home gym" value={profile.homeGym?.trim() || "—"} />
          <DetailRow icon={Target} label="Goal" value={profile.goal || "—"} />
          <DetailRow icon={TrendingUp} label="Experience" value={profile.experienceLevel || "—"} />
          <DetailRow icon={CalendarCheck} label="Weekly target" value={profile.weeklyWorkoutGoal != null ? `${profile.weeklyWorkoutGoal} workouts per week` : "—"} />
          <DetailRow icon={Ruler} label="Units" value={profile.units === "imperial" ? "Imperial (lb, ft)" : "Metric (kg, cm)"} />
        </div>
      </div>

      {/* Data section */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Your data</div>
        <button
          onClick={handleExport}
          className="w-full surface border border-soft card-shadow rounded-2xl p-4 flex items-center gap-3 hover:bg-navy-50 transition text-left"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
            <Download size={18} className="text-navy-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy-900">Export workout history</div>
            <div className="text-xs text-navy-500 mt-0.5">Download all sets as a CSV file · {history.length} entries</div>
          </div>
          <ChevronRight size={16} className="text-navy-300 shrink-0" />
        </button>
      </div>

      {/* Sign out moved to Settings → Account. */}

      {/* CSV fallback modal — shown when direct download isn't available (sandboxed previews) */}
      {csvFallback && (
        <div className="fixed inset-0 z-30 backdrop-blur-sm flex items-end" style={{ background: "var(--modal-overlay-strong)" }} onClick={() => setCsvFallback(null)}>
          <div
            className="max-w-md w-full mx-auto surface border-t border-soft rounded-t-3xl p-5 pb-8 flex flex-col"
            style={{ maxHeight: "85vh" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--border-strong)" }} />
            <div className="serif text-xl text-navy-900 mb-1" style={{ fontWeight: 500 }}>Your workout data</div>
            <div className="text-xs text-navy-500 mb-4 leading-relaxed">
              Direct download isn't available here. Copy the CSV below and paste it into a spreadsheet, or save it as <span className="mono">{csvFallback.filename}</span>.
            </div>
            <textarea
              readOnly
              value={csvFallback.csv}
              onClick={e => e.target.select()}
              className="w-full surface-2 border border-soft rounded-xl p-3 text-[11px] mono text-navy-700 resize-none focus:outline-none focus:border-strong"
              style={{ minHeight: "200px", flex: 1 }}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setCsvFallback(null)} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Close</button>
              <button
                onClick={handleCopy}
                className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                style={{ background: copied ? "var(--success)" : "var(--primary)" }}
              >
                {copied ? <><Check size={14} strokeWidth={2.5} /> Copied</> : <><Download size={14} /> Copy CSV</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileStat({ label, value, unit }) {
  return (
    <div className="surface border border-soft card-shadow rounded-xl p-3">
      <div className="text-[9px] uppercase tracking-wider text-navy-500 mono font-medium">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="text-xl font-semibold mono text-navy-900 truncate">{value}</div>
        {unit && <div className="text-[10px] text-navy-400 mono">{unit}</div>}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon size={15} className="text-navy-400 shrink-0" />
      <div className="text-sm text-navy-500 w-28 shrink-0">{label}</div>
      <div className="text-sm font-medium text-navy-900 truncate flex-1 text-right">{value}</div>
    </div>
  );
}

function ProfileEditView({ profile, saveError, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...profile });
  const [validationError, setValidationError] = useState(null);
  const fileInputRef = useRef(null);

  const update = (patch) => setDraft({ ...draft, ...patch });

  const handleSave = () => {
    // Mirror the signup-time age check so users can't edit themselves
    // under the minimum age. Only validates when a DOB is present —
    // empty DOB is allowed (the field is optional after the initial
    // signup write).
    if (draft.dateOfBirth) {
      const age = ageFromDob(draft.dateOfBirth);
      if (age != null && age < MIN_AGE) {
        setValidationError(`You must be at least ${MIN_AGE} years old.`);
        return;
      }
    }
    setValidationError(null);
    onSave(draft);
  };

  // Either local validation error or server save error fills the banner;
  // local validation wins when both are set since it's immediate feedback.
  const bannerError = validationError || saveError;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ photo: reader.result });
    reader.readAsDataURL(file);
  };

  const initials = useMemo(() => draft.name ? draft.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() : "?", [draft.name]);

  // Independent state for imperial inputs so user typing doesn't fight round-trip conversion.
  // We seed once from cm, then only sync TO cm (not back).
  const [heightFeet, setHeightFeet] = useState(() =>
    profile.heightCm ? String(Math.floor(profile.heightCm / 2.54 / 12)) : ""
  );
  const [heightInches, setHeightInches] = useState(() =>
    profile.heightCm ? String(Math.round(profile.heightCm / 2.54 % 12)) : ""
  );
  const [weightLb, setWeightLb] = useState(() =>
    profile.weightKg ? String(Math.round(profile.weightKg * 2.205)) : ""
  );

  // Sync imperial inputs → cm/kg whenever they change, but only when in imperial mode
  useEffect(() => {
    if (draft.units !== "imperial") return;
    const f = parseInt(heightFeet) || 0;
    const i = parseInt(heightInches) || 0;
    const cm = (f === 0 && i === 0) ? null : Math.round(((f * 12) + i) * 2.54);
    if (cm !== draft.heightCm) update({ heightCm: cm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightFeet, heightInches]);

  useEffect(() => {
    if (draft.units !== "imperial") return;
    const l = parseFloat(weightLb) || 0;
    const kg = l === 0 ? null : Math.round(l / 2.205 * 10) / 10;
    if (kg !== draft.weightKg) update({ weightKg: kg });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightLb]);

  // When user toggles unit system, re-seed the imperial inputs from current metric values
  // (so switching imperial → metric → imperial doesn't lose data)
  useEffect(() => {
    if (draft.units === "imperial") {
      const cm = draft.heightCm;
      setHeightFeet(cm ? String(Math.floor(cm / 2.54 / 12)) : "");
      setHeightInches(cm ? String(Math.round(cm / 2.54 % 12)) : "");
      setWeightLb(draft.weightKg ? String(Math.round(draft.weightKg * 2.205)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.units]);

  const canSave = draft.name.trim();

  // DOB picker bounds: today on the upper end, 100 years ago on the lower
  // so the year-scroll doesn't run away.
  const maxBirthDate = new Date().toISOString().split("T")[0];
  const minBirthDate = new Date(Date.now() - 100 * 365.25 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  return (
    <div className="px-5 pb-32">
      {/* Photo */}
      <div className="mt-5 flex flex-col items-center">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center relative"
          style={{
            background: draft.photo ? "transparent" : "var(--avatar-bg)",
            border: "3px solid var(--surface)",
            boxShadow: "var(--avatar-shadow-lg)",
          }}
        >
          {draft.photo ? (
            <img src={draft.photo} alt={draft.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-semibold text-white mono">{initials}</span>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-navy-700 px-3 py-1.5 rounded-full surface border border-soft flex items-center gap-1.5 hover:bg-navy-50 transition"
          >
            <Camera size={12} /> {draft.photo ? "Change photo" : "Add photo"}
          </button>
          {draft.photo && (
            <button
              onClick={() => update({ photo: null })}
              className="text-xs font-medium text-navy-500 px-3 py-1.5 rounded-full hover:text-red-600 transition"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {bannerError && (
        <div
          className="mt-5 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
          style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
        >
          {bannerError}
        </div>
      )}

      <div className="mt-7 space-y-4">
        <Field label="Full name">
          <input value={draft.name} onChange={e => update({ name: e.target.value })} placeholder="Your name" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Email" hint="Your sign-in email. Edit this from account settings (coming soon).">
          <input
            type="email"
            value={draft.email || ""}
            disabled
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none text-navy-500 cursor-not-allowed"
          />
        </Field>

        <Field label="Home gym" hint="Where you usually train — shown on your profile">
          <input value={draft.homeGym || ""} onChange={e => update({ homeGym: e.target.value })} placeholder="e.g. Synergy Health & Sports Performance" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Date of birth">
          <input type="date" min={minBirthDate} max={maxBirthDate} value={draft.dateOfBirth || ""} onChange={e => update({ dateOfBirth: e.target.value })} className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Gender">
          <div className="flex flex-wrap gap-1.5">
            {["Male", "Female", "Non-binary", "Prefer not to say"].map(g => (
              <FilterChip key={g} active={draft.gender === g} onClick={() => update({ gender: g })}>{g}</FilterChip>
            ))}
          </div>
        </Field>

        <Field label="Preferred units">
          <div className="flex gap-1.5">
            <FilterChip active={draft.units === "imperial"} onClick={() => update({ units: "imperial" })}>Imperial (lb, ft)</FilterChip>
            <FilterChip active={draft.units === "metric"} onClick={() => update({ units: "metric" })}>Metric (kg, cm)</FilterChip>
          </div>
        </Field>

        <Field label="Height">
          {draft.units === "imperial" ? (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={heightFeet} onChange={e => setHeightFeet(e.target.value)} onFocus={focusToEnd} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">ft</span>
              <input type="number" inputMode="numeric" value={heightInches} onChange={e => setHeightInches(e.target.value)} onFocus={focusToEnd} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">in</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={draft.heightCm || ""} onChange={e => update({ heightCm: parseInt(e.target.value) || null })} onFocus={focusToEnd} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">cm</span>
            </div>
          )}
        </Field>

        <Field label="Weight">
          {draft.units === "imperial" ? (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" value={weightLb} onChange={e => setWeightLb(e.target.value)} onFocus={focusToEnd} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">lb</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" step="0.1" value={draft.weightKg || ""} onChange={e => update({ weightKg: parseFloat(e.target.value) || null })} onFocus={focusToEnd} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">kg</span>
            </div>
          )}
        </Field>

        <Field label="Fitness goal" hint="May influence smart suggestions in future updates">
          <div className="flex flex-wrap gap-1.5">
            {["Strength", "Hypertrophy", "Endurance", "Weight loss", "General fitness"].map(g => (
              <FilterChip key={g} active={draft.goal === g} onClick={() => update({ goal: g })}>{g}</FilterChip>
            ))}
          </div>
        </Field>

        <Field label="Weekly workout target" hint="How many workouts per week you're aiming for. Used to track consistency on Home.">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={draft.weeklyWorkoutGoal == null} onClick={() => update({ weeklyWorkoutGoal: null })}>No goal</FilterChip>
            {[2, 3, 4, 5, 6, 7].map(n => (
              <FilterChip key={n} active={draft.weeklyWorkoutGoal === n} onClick={() => update({ weeklyWorkoutGoal: n })}>{n}</FilterChip>
            ))}
          </div>
        </Field>

        <Field label="Experience level">
          <div className="flex flex-wrap gap-1.5">
            {["Beginner", "Intermediate", "Advanced"].map(level => (
              <FilterChip key={level} active={draft.experienceLevel === level} onClick={() => update({ experienceLevel: level })}>{level}</FilterChip>
            ))}
          </div>
        </Field>
      </div>

      <BottomBar>
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
        <button
          onClick={() => canSave && handleSave()}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition"
          style={{ background: "var(--primary)" }}
        >
          Save
        </button>
      </BottomBar>
    </div>
  );
}

// --- CSV EXPORT ---
function buildCsv(sessions, history, exercises = []) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const libByName = new Map((exercises || []).map(e => [e.name, e]));
  const rows = [];
  rows.push([
    "Date", "Time", "Workout name", "Exercise", "Set #",
    "Weight", "Unit", "Reps", "Tracking mode", "Note"
  ]);
  const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
  sortedHistory.forEach(entry => {
    const session = sessionMap.get(entry.workoutId);
    const d = new Date(entry.date);
    const dateStr = d.toLocaleDateString("en-CA");
    const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const workoutName = session?.name || "";
    // Bodyweight (or weight=0) entries: leave Weight empty so the CSV doesn't read
    // as a misleading 0. Unit also drops out since there's nothing to qualify.
    const weightCell = entry.weight > 0 ? entry.weight : "";
    const unitCell = entry.weight > 0 ? entry.unit : "";
    // Tracking mode comes from the current library — historical entries
    // don't carry it themselves, so an exercise renamed/deleted since
    // logging falls back to 'reps'.
    const mode = trackingModeFor(libByName.get(entry.exercise));
    entry.reps.forEach((reps, i) => {
      rows.push([
        dateStr, timeStr, workoutName, entry.exercise, i + 1,
        weightCell, unitCell, reps, mode, entry.note || "",
      ]);
    });
  });
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(",")
  ).join("\n");
}

function csvFilename(profile) {
  const dateStamp = new Date().toISOString().split("T")[0];
  const safeName = (profile.name || "user").toLowerCase().replace(/\s+/g, "-");
  return `spotter-${safeName}-${dateStamp}.csv`;
}

// Returns true if download succeeded, false if it was blocked or unavailable
function tryDownloadCsv(csv, filename) {
  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    if (typeof URL === "undefined" || !URL.createObjectURL) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return true;
  } catch (err) {
    console.warn("CSV download failed, falling back to modal:", err);
    return false;
  }
}

// --- HEALTH STUB ---
function HealthView() {
  const cards = [
    { icon: Scale, label: "Body weight", desc: "Track your weight over time" },
    { icon: Footprints, label: "Steps", desc: "Sync from Apple Health" },
    { icon: Trophy, label: "Personal records", desc: "All-time bests by exercise" },
    { icon: Activity, label: "Volume trends", desc: "Charts of total weekly load" },
  ];
  return (
    <div className="px-5 pb-28">
      <div className="mt-5 rounded-2xl p-5 border border-soft card-shadow" style={{ background: "var(--coming-soon-bg)" }}>
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          <div className="text-[10px] uppercase tracking-[0.18em] mono font-semibold" style={{ color: "var(--accent)" }}>Coming in v2</div>
        </div>
        <div className="text-navy-700 text-sm leading-relaxed">
          Hooking into Apple Health, tracking body metrics, and surfacing your progress visually.
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="surface border border-soft card-shadow rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--navy-50)" }}>
                <Icon size={18} className="text-navy-700" />
              </div>
              <div className="font-semibold text-sm text-navy-900">{c.label}</div>
              <div className="text-xs text-navy-500 mt-1 leading-snug">{c.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- EXERCISE DETAIL ---
function ExerciseDetailView({ entries, libEx, onEdit, onCustomize }) {
  // libEx absent (e.g. an exercise referenced by history but since deleted)
  // — render a minimal explanation rather than the full layout, since
  // there's no metadata to show.
  if (!libEx) {
    return (
      <div className="px-5 pb-20">
        <div className="mt-8 surface border border-soft card-shadow rounded-2xl p-5 text-sm text-navy-600 leading-relaxed">
          This exercise is no longer in your library.
        </div>
      </div>
    );
  }
  const isPublic = libEx.visibility === "public";
  const isTime = isTimeTracked(libEx);
  const targetNoun = isTime ? "seconds" : "reps";
  const suffix = setUnitSuffix(libEx);
  const bumpRuleLabel = {
    all: "Every set hits the top",
    majority: "Most sets hit the top",
    any: "Any single set hits the top",
  }[libEx.bumpRule || "all"];
  const latest = entries[0] || null;
  const prog = latest ? getProgressionStatus(latest, libEx) : null;

  return (
    <div className="px-5 pb-20">
      {/* About card — always rendered, even when there's no history. This
          is the screen's primary content for any exercise the user hasn't
          logged yet (most relevant for the public catalog). */}
      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Defaults</div>
        <div className="surface border border-soft card-shadow rounded-2xl divide-y" style={{ borderColor: "var(--border)" }}>
          <DetailRow icon={Activity} label="Muscle group" value={libEx.muscle || "—"} />
          <DetailRow icon={Dumbbell} label="Equipment" value={libEx.equipment || "—"} />
          <DetailRow icon={Clock} label="Tracking mode" value={isTime ? "Time" : "Reps"} />
          <DetailRow
            icon={Target}
            label={isTime ? "Target time range" : "Target rep range"}
            value={`${libEx.targetReps[0]}–${libEx.targetReps[1]} ${targetNoun}`}
          />
          <DetailRow icon={Scale} label="Weight" value={tracksWeightFor(libEx) ? `Uses weight (+${libEx.increment ?? 5} ${libEx.unit})` : "Bodyweight"} />
          <DetailRow icon={TrendingUp} label="Progression rule" value={bumpRuleLabel} />
        </div>
      </div>

      {/* Edit / Customize action. Public catalog rows show Customize (which
          inserts a private copy and opens its edit form); private rows show
          Edit. */}
      <button
        onClick={() => isPublic ? onCustomize?.() : onEdit?.(libEx.id)}
        className="mt-4 w-full text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition"
        style={{ background: "var(--primary)" }}
      >
        {isPublic ? <><Sparkles size={14} /> Customize</> : <><Edit3 size={14} /> Edit defaults</>}
      </button>

      {isPublic && (
        <div className="mt-3 text-xs text-navy-500 leading-relaxed">
          This is part of Spotter's catalog. To change the defaults, customize a copy you own.
        </div>
      )}

      {/* Last-time hero + history list — only when the user has logged
          this exercise at least once. */}
      {latest && (
        <div className="mt-7 rounded-2xl p-5 card-shadow-lg" style={{ background: "var(--hero-bg)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-white/60" />
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mono font-medium">Last time · {formatDate(latest.date)}</div>
          </div>
          <div className="flex items-baseline gap-3">
            {latest.weight > 0 ? (
              <>
                <div className="text-5xl font-semibold tracking-tight mono text-white">{latest.weight}</div>
                <div className="text-white/60 text-lg mono">{latest.unit}</div>
              </>
            ) : (
              <div className="text-5xl font-semibold tracking-tight mono text-white">Bodyweight</div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {latest.reps.map((r, i) => (
              <div key={i} className="flex-1 rounded-lg py-2.5 text-center" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mono">Set {i + 1}</div>
                <div className="text-xl font-semibold mt-0.5 mono text-white">{r}{suffix}</div>
              </div>
            ))}
          </div>
          {latest.note && <div className="mt-3 text-xs text-white/70 italic">"{latest.note}"</div>}
          {prog && (
            <div className="mt-4 rounded-lg p-3 flex items-start gap-2.5" style={{ background: "rgba(255,255,255,0.08)" }}>
              {prog.status === "bump" && <Flame size={14} style={{ color: "var(--accent-soft)" }} className="mt-0.5 shrink-0" />}
              {prog.status === "hold" && <Minus size={14} className="text-white/60 mt-0.5 shrink-0" />}
              {prog.status === "progress" && <TrendingUp size={14} style={{ color: "var(--success-soft)" }} className="mt-0.5 shrink-0" />}
              <div className="text-xs text-white/90 leading-relaxed">{prog.message}</div>
            </div>
          )}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">History</div>
          <div className="space-y-2">
            {entries.map(entry => {
              const total = entry.reps.reduce((a, b) => a + b, 0);
              const setsStr = entry.reps.map(r => `${r}${suffix}`).join(" · ");
              return (
                <div key={entry.id} className="surface border border-soft card-shadow rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-navy-500 mono">{formatDate(entry.date)}</div>
                    {/* Volume tile is meaningless for time-tracked sets — they're seconds. */}
                    {!isTime && <div className="text-[10px] text-navy-300 mono">vol {total}</div>}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {entry.weight > 0 ? (
                      <>
                        <div className="text-2xl font-semibold mono text-navy-900">{entry.weight}</div>
                        <div className="text-navy-400 text-xs mono">{entry.unit}</div>
                        <div className="text-navy-300 mono">×</div>
                        <div className="text-navy-700 mono text-sm">{setsStr}</div>
                      </>
                    ) : (
                      <div className="text-2xl font-semibold mono text-navy-900">{setsStr}</div>
                    )}
                  </div>
                  {entry.note && <div className="mt-2 text-xs text-navy-500 italic">"{entry.note}"</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="mt-7 surface-2 border border-dashed border-strong rounded-xl p-5 text-center text-sm text-navy-500">
          No sessions logged yet. Start a workout to see your history here.
        </div>
      )}
    </div>
  );
}

// --- ACTIVE WORKOUT ---
function WorkoutView({ workout, setWorkout, exercises, lastByExercise, settings, onCreateExercise, onFinish, librarySaveError }) {
  const showLevelUpAlerts = settings?.showLevelUpAlerts ?? true;
  const defaultUnit = settings?.defaultUnit || "lb";
  const [showPicker, setShowPicker] = useState(workout.exercises.length === 0 && workout.planQueue.length === 0);
  // The active exercise is derived from workout.currentExerciseName instead
  // of held in local state. That way the minimized bar (which reads from
  // workout state) always matches what the user was viewing — and the
  // value survives a cold app reload via localStorage. Falls back to the
  // last exercise when the name doesn't match anything (legacy workouts
  // from before this field existed, or the named exercise was removed).
  const activeIdx = useMemo(() => {
    if (workout.exercises.length === 0) return 0;
    const idx = workout.currentExerciseName
      ? workout.exercises.findIndex(e => e.exercise === workout.currentExerciseName)
      : -1;
    return idx >= 0 ? idx : workout.exercises.length - 1;
  }, [workout.currentExerciseName, workout.exercises]);
  const setActiveExercise = (idx) => {
    const name = workout.exercises[idx]?.exercise;
    if (name) setWorkout({ ...workout, currentExerciseName: name });
  };
  const [showFinish, setShowFinish] = useState(false);
  // Resumed workouts pre-fill the original session name so the user
  // doesn't have to retype it. New workouts start blank as before.
  const [workoutName, setWorkoutName] = useState(workout.resumedSessionName || "");
  // When non-null, open the full ExerciseEditView as a modal pre-filled with this name.
  const [pendingNewExerciseName, setPendingNewExerciseName] = useState(null);
  // Locks the finish modal while the persist round-trip is in flight so a
  // double-tap can't fire two inserts.
  const [finishing, setFinishing] = useState(false);

  const handleFinishConfirm = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await onFinish(workoutName.trim() || "Workout");
      // On success the component unmounts (App clears activeWorkout). On
      // failure librarySaveError surfaces below and the modal stays open.
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    if (workout.exercises.length === 0 && workout.planQueue.length > 0) {
      const queueExercises = workout.planQueue.map(name => {
        const last = lastByExercise.get(name);
        const libEx = exercises.find(e => e.name === name);
        return last ? buildExerciseFromHistory(last, libEx) : buildBlankExercise(name, libEx);
      });
      // Bundle the exercises swap with the initial currentExerciseName so
      // the minimized bar can pick up the right name on first minimize
      // without a stale-state flicker.
      setWorkout({
        ...workout,
        exercises: queueExercises,
        planQueue: [],
        currentExerciseName: queueExercises[0]?.exercise || null,
      });
    }
    // eslint-disable-next-line
  }, []);

  const addExercise = (exerciseName) => {
    const last = lastByExercise.get(exerciseName);
    const libEx = exercises.find(e => e.name === exerciseName);
    const newExercise = last ? buildExerciseFromHistory(last, libEx) : buildBlankExercise(exerciseName, libEx);
    const newExercises = [...workout.exercises, newExercise];
    // Newly added exercise becomes the active one — same behavior as
    // before, just persisted on the workout itself.
    setWorkout({ ...workout, exercises: newExercises, currentExerciseName: newExercise.exercise });
    setShowPicker(false);
  };

  // Open the editor modal pre-filled with the typed name; defer creation until Save.
  // addExercise itself closes the picker, so we only need to clear the modal state.
  const handleCreateNew = (newName) => setPendingNewExerciseName(newName);
  const handleSaveNewExercise = async (payload) => {
    const created = await onCreateExercise(payload);
    if (!created) return; // librarySaveError surfaces in the modal
    addExercise(created.name);
    setPendingNewExerciseName(null);
  };

  const updateExercise = (idx, patch) => {
    const updated = [...workout.exercises];
    updated[idx] = { ...updated[idx], ...patch };
    setWorkout({ ...workout, exercises: updated });
  };

  const removeExercise = (idx) => {
    const updated = workout.exercises.filter((_, i) => i !== idx);
    // Pick the same focus rule as before (previous exercise, or new last
    // when removing past the end), translated to a name.
    let nextIdx;
    if (activeIdx >= updated.length) {
      nextIdx = Math.max(0, updated.length - 1);
    } else if (idx <= activeIdx && activeIdx > 0) {
      nextIdx = activeIdx - 1;
    } else {
      nextIdx = activeIdx;
    }
    const nextName = updated[nextIdx]?.exercise || null;
    setWorkout({ ...workout, exercises: updated, currentExerciseName: nextName });
    // If we just removed the last exercise, open the picker so the workout isn't empty
    if (updated.length === 0) setShowPicker(true);
  };

  if (showPicker) {
    return (
      <div className="px-5 pb-20 mt-5">
        <ExerciseSearchSheet exercises={exercises} lastByExercise={lastByExercise} excluded={workout.exercises.map(e => e.exercise)} onPick={addExercise} onCreateNew={handleCreateNew} onClose={() => workout.exercises.length > 0 && setShowPicker(false)} />
        {pendingNewExerciseName !== null && (
          <ExerciseEditModal
            initialName={pendingNewExerciseName}
            defaultUnit={defaultUnit}
            saveError={librarySaveError}
            onSave={handleSaveNewExercise}
            onCancel={() => setPendingNewExerciseName(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pb-32">
      {workout.exercises.length > 1 && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
          {workout.exercises.map((ex, i) => {
            const completed = ex.reps.filter(r => r > 0).length;
            return (
              <button
                key={i}
                onClick={() => setActiveExercise(i)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition font-medium"
                style={{
                  background: i === activeIdx ? "var(--primary)" : "var(--surface)",
                  color: i === activeIdx ? "white" : "var(--navy-600)",
                  borderColor: i === activeIdx ? "var(--primary)" : "var(--border)",
                }}
              >
                {ex.exercise.split(" ").slice(0,2).join(" ")} {completed > 0 && <span className="ml-1 mono">{completed}/{ex.reps.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {workout.exercises[activeIdx] && (
        <ActiveExercise
          ex={workout.exercises[activeIdx]}
          showLevelUpAlerts={showLevelUpAlerts}
          onUpdate={(patch) => updateExercise(activeIdx, patch)}
          onRemove={() => removeExercise(activeIdx)}
        />
      )}

      <button onClick={() => setShowPicker(true)} className="mt-4 w-full surface-2 border border-dashed border-strong text-navy-600 py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-navy-50 transition">
        <Plus size={16} /> Add another exercise
      </button>

      {showFinish && (
        <div className="fixed inset-0 z-30 backdrop-blur-sm flex items-end" style={{ background: "var(--modal-overlay)" }} onClick={() => !finishing && setShowFinish(false)}>
          <div className="max-w-md w-full mx-auto surface border-t border-soft rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-strong)" }} />
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Name this workout</div>
            <input autoFocus value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="e.g. Push Day" className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
            {librarySaveError && (
              <div
                className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
                style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
              >
                {librarySaveError}
              </div>
            )}
            <button
              onClick={handleFinishConfirm}
              disabled={finishing}
              className="mt-4 w-full text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition"
              style={{ background: "var(--success)" }}
            >
              <Check size={18} strokeWidth={2.5} /> {finishing ? "Saving…" : "Save workout"}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-soft" style={{ background: "var(--bar-bg)" }}>
        <div className="max-w-md mx-auto px-5 py-3">
          <button onClick={() => setShowFinish(true)} className="w-full text-white py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 navy-shadow transition" style={{ background: "var(--success)" }}>
            <Check size={18} strokeWidth={2.5} /> Finish Workout
          </button>
        </div>
      </div>
    </div>
  );
}

function buildExerciseFromHistory(sourceEntry, libEx) {
  const prog = getProgressionStatus(sourceEntry, libEx);
  const weighted = tracksWeightFor(libEx);
  const mode = trackingModeFor(libEx);
  // Bodyweight progression happens via reps/seconds, not weight, so don't
  // pre-bump the weight value.
  const startWeight = (weighted && prog?.status === "bump")
    ? suggestedNextWeight(sourceEntry, libEx)
    : sourceEntry.weight;
  return {
    exercise: sourceEntry.exercise,
    weight: startWeight,
    lastWeight: sourceEntry.weight,
    lastReps: sourceEntry.reps,
    lastDate: sourceEntry.date,
    targetReps: libEx?.targetReps || sourceEntry.targetReps,
    unit: libEx?.unit || sourceEntry.unit,
    tracksWeight: weighted,
    trackingMode: mode,
    increment: libEx?.increment ?? (sourceEntry.weight < 50 ? 2.5 : 5),
    reps: [0, 0, 0],
    note: "",
    bumped: weighted && prog?.status === "bump",
    // Bodyweight time exercises progress by holding longer next session,
    // not by adding weight. Surface a separate flag so the active view
    // can show "Holding longer" copy without conflating it with a weight bump.
    holdLonger: !weighted && mode === "time" && prog?.status === "bump",
  };
}

function buildBlankExercise(name, libEx) {
  return {
    exercise: name, weight: 0, lastWeight: null, lastReps: [], lastDate: null,
    targetReps: libEx?.targetReps || [8, 12], unit: libEx?.unit || "lb",
    tracksWeight: tracksWeightFor(libEx),
    trackingMode: trackingModeFor(libEx),
    increment: libEx?.increment ?? 5,
    reps: [0, 0, 0], note: "", bumped: false, holdLonger: false,
  };
}

function ActiveExercise({ ex, showLevelUpAlerts = true, onUpdate, onRemove }) {
  const isBodyweight = ex.tracksWeight === false;
  const isTime = ex.trackingMode === "time";
  const setNoun = isTime ? "seconds" : "reps";
  const setSuffix = isTime ? "s" : "";
  // +/- step on each set: 5 for time (more useful for plank-class
  // increments), 1 for reps. Also drives the editor placeholder.
  const setStep = isTime ? 5 : 1;
  const [showNotes, setShowNotes] = useState(!!ex.note);
  const [restTimer, setRestTimer] = useState(null);
  const [restNow, setRestNow] = useState(Date.now());
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  // For bodyweight exercises, hide the weight card by default. Reveal it if a
  // weight is already set (e.g. vest from a prior session) or if the user taps
  // the "Add weight" affordance.
  const [showWeightCard, setShowWeightCard] = useState(!isBodyweight || ex.weight > 0);
  const weightInputRef = useRef(null);

  // Re-evaluate visibility when switching between exercises in a multi-exercise workout.
  // Only depends on ex.exercise — once the user reveals the card, typing the weight
  // back to 0 shouldn't auto-hide it.
  useEffect(() => {
    setShowWeightCard(!isBodyweight || ex.weight > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.exercise]);

  // Reset confirm state if exercise changes
  useEffect(() => { setConfirmRemove(false); }, [ex.exercise]);

  // Auto-cancel confirm after 3 seconds
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 3000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  useEffect(() => {
    if (!restTimer) return;
    const i = setInterval(() => setRestNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [restTimer]);

  // When entering edit mode, focus and select the input
  useEffect(() => {
    if (editingWeight && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [editingWeight]);

  const beginWeightEdit = () => {
    // Display empty when weight is 0 so the user can type without a leading 0.
    setWeightDraft(ex.weight > 0 ? String(ex.weight) : "");
    setEditingWeight(true);
  };

  const commitWeightEdit = () => {
    const parsed = parseFloat(weightDraft);
    if (!isNaN(parsed) && parsed >= 0) {
      // Round to nearest 0.1
      onUpdate({ weight: Math.round(parsed * 10) / 10 });
    }
    setEditingWeight(false);
  };

  const cancelWeightEdit = () => {
    setEditingWeight(false);
    setWeightDraft("");
  };

  const adjustWeight = (delta) => {
    const newWeight = Math.max(0, ex.weight + delta);
    onUpdate({ weight: Math.round(newWeight * 10) / 10 });
  };

  const setReps = (idx, value) => {
    const newReps = [...ex.reps];
    const oldVal = newReps[idx];
    newReps[idx] = Math.max(0, value);
    onUpdate({ reps: newReps });
    if (value > 0 && oldVal === 0) setRestTimer({ startedAt: Date.now() });
  };

  const addSet = () => onUpdate({ reps: [...ex.reps, 0] });
  const removeSet = (idx) => onUpdate({ reps: ex.reps.filter((_, i) => i !== idx) });

  const restElapsed = restTimer ? Math.floor((restNow - restTimer.startedAt) / 1000) : 0;

  return (
    <div className="mt-5">
      <div className="mb-4">
        <div className="serif text-[26px] tracking-tight text-navy-900" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>{ex.exercise}</div>
        {ex.bumped && showLevelUpAlerts && (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider mono font-semibold" style={{ color: "var(--accent)" }}>
            <Flame size={11} /> Bumped from {ex.lastWeight}{ex.unit}
          </div>
        )}
        {ex.holdLonger && showLevelUpAlerts && (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider mono font-semibold" style={{ color: "var(--accent)" }}>
            <Flame size={11} /> Holding longer than last time
          </div>
        )}
      </div>

      {ex.lastDate ? (
        <div className="surface border border-soft rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">Last time · {formatDate(ex.lastDate)}</div>
            <div className="text-xs mono text-navy-700">
              {ex.lastWeight > 0 ? `${ex.lastWeight}${ex.unit} × ` : ""}{ex.lastReps.map(r => `${r}${setSuffix}`).join(" · ")}
            </div>
          </div>
        </div>
      ) : (
        <div className="surface border border-dashed border-strong rounded-xl p-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">No history — first time</div>
        </div>
      )}

      {showWeightCard ? (
        <div className="rounded-2xl p-5 card-shadow-lg" style={{ background: "var(--hero-bg)" }}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 mono font-medium mb-3">Weight</div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => adjustWeight(-(ex.increment ?? 5))} className="w-12 h-12 rounded-full flex items-center justify-center transition shrink-0 active:scale-95" style={{ background: "rgba(255,255,255,0.12)", color: "white" }}>
              <Minus size={18} />
            </button>
            <div className="flex-1 text-center">
              {editingWeight ? (
                <input
                  ref={weightInputRef}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weightDraft}
                  onChange={e => setWeightDraft(e.target.value)}
                  onBlur={commitWeightEdit}
                  onFocus={focusToEnd}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.target.blur(); }
                    else if (e.key === "Escape") { cancelWeightEdit(); }
                  }}
                  className="w-full bg-transparent text-5xl font-semibold tracking-tight mono text-white text-center focus:outline-none"
                  style={{
                    caretColor: "white",
                    borderBottom: "2px solid rgba(255,255,255,0.5)",
                    paddingBottom: "2px",
                  }}
                />
              ) : (
                <button onClick={beginWeightEdit} className="w-full active:opacity-70 transition" aria-label="Edit weight">
                  <div className="text-5xl font-semibold tracking-tight mono text-white">{ex.weight}</div>
                </button>
              )}
              <div className="text-white/60 text-xs mono mt-0.5">{ex.unit}{!editingWeight && <span className="ml-2 text-white/40 text-[10px]">tap to edit</span>}</div>
            </div>
            <button onClick={() => adjustWeight(ex.increment ?? 5)} className="w-12 h-12 rounded-full flex items-center justify-center transition shrink-0 active:scale-95" style={{ background: "rgba(255,255,255,0.12)", color: "white" }}>
              <Plus size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowWeightCard(true); beginWeightEdit(); }}
          className="text-xs text-navy-500 hover:text-navy-900 flex items-center gap-1.5 transition"
        >
          <Plus size={12} /> Add weight (e.g. vest, dumbbell)
        </button>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">Sets · target {ex.targetReps[0]}–{ex.targetReps[1]} {setNoun}</div>
          {restTimer && (
            <button onClick={() => setRestTimer(null)} className="flex items-center gap-1.5 text-[10px] mono uppercase tracking-wider px-2 py-1 rounded-full font-semibold" style={{ color: "var(--success)", background: "var(--success-bg)" }}>
              <Clock size={10} /> rest {Math.floor(restElapsed/60)}:{String(restElapsed%60).padStart(2,"0")}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {ex.reps.map((r, i) => (
            <SetRow key={i} setNum={i + 1} reps={r} lastReps={ex.lastReps[i]} targetMax={ex.targetReps[1]} unitSuffix={setSuffix} step={setStep} onChange={(v) => setReps(i, v)} onRemove={ex.reps.length > 1 ? () => removeSet(i) : null} />
          ))}
        </div>
        <button onClick={addSet} className="mt-2 w-full surface-2 border border-dashed border-strong text-navy-500 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-navy-50 transition">
          <Plus size={12} /> Add set
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {!showNotes ? (
          <button onClick={() => setShowNotes(true)} className="text-xs text-navy-500 hover:text-navy-900 flex items-center gap-1.5 transition">
            <Edit3 size={12} /> Add note
          </button>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Note</div>
            <textarea value={ex.note} onChange={(e) => onUpdate({ note: e.target.value })} placeholder="e.g. felt heavy, form was off on last set..." className="w-full surface border border-soft rounded-xl p-3 text-sm text-navy-900 placeholder-navy-300 resize-none focus:outline-none focus:border-strong" rows={2} />
          </div>
        )}

        {onRemove && !showNotes && (
          <button
            onClick={() => {
              if (confirmRemove) onRemove();
              else setConfirmRemove(true);
            }}
            className="text-xs flex items-center gap-1.5 transition shrink-0"
            style={{ color: confirmRemove ? "var(--destructive)" : "var(--navy-400)" }}
          >
            <Trash2 size={12} />
            {confirmRemove ? "Tap to confirm" : "Remove"}
          </button>
        )}
      </div>

      {onRemove && showNotes && (
        <button
          onClick={() => {
            if (confirmRemove) onRemove();
            else setConfirmRemove(true);
          }}
          className="mt-3 text-xs flex items-center gap-1.5 transition"
          style={{ color: confirmRemove ? "var(--destructive)" : "var(--navy-400)" }}
        >
          <Trash2 size={12} />
          {confirmRemove ? "Tap to confirm removal" : "Remove this exercise"}
        </button>
      )}
    </div>
  );
}

function SetRow({ setNum, reps, lastReps, targetMax, unitSuffix = "", step = 1, onChange, onRemove }) {
  const hitTarget = reps >= targetMax;
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-xl border transition"
      style={{
        background: reps > 0 ? hitTarget ? "var(--success-bg)" : "var(--surface)" : "var(--surface-2)",
        borderColor: reps > 0 ? hitTarget ? "var(--success-border)" : "var(--border)" : "var(--border)",
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] uppercase tracking-wider mono shrink-0 font-semibold" style={{ background: "var(--navy-50)", color: "var(--navy-600)" }}>{setNum}</div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(reps - step)} className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
          <Minus size={14} />
        </button>
        <input type="number" inputMode="numeric" value={reps || ""} onChange={(e) => onChange(parseInt(e.target.value) || 0)} onFocus={focusToEnd} placeholder={lastReps ? String(lastReps) : "0"} className="w-14 h-9 surface border border-soft rounded-lg text-center text-base font-semibold mono focus:outline-none focus:border-strong text-navy-900" />
        <button onClick={() => onChange(reps + step)} className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-end gap-2 text-[10px] mono text-navy-400">
        {lastReps !== undefined && <span>last: {lastReps}{unitSuffix}</span>}
        {onRemove && (
          <button onClick={onRemove} className="text-navy-300 hover:text-red-600 p-1 transition">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- SETTINGS ---
// Each section is a labeled group of rows on a card surface, mirroring
// the existing Profile About / Your-data layout. onChange takes a partial
// settings patch and bubbles up to App's updateSettings, which handles
// the optimistic write + Supabase persist + rollback.
function SettingsView({ settings, onChange, onDeleteAccount, saveError }) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Auto-cancel the sign-out confirmation after 3s, matching the
  // tap-to-confirm pattern used elsewhere (Delete buttons).
  useEffect(() => {
    if (!confirmSignOut) return;
    const t = setTimeout(() => setConfirmSignOut(false), 3000);
    return () => clearTimeout(t);
  }, [confirmSignOut]);

  return (
    <div className="px-5 pb-28">
      {saveError && (
        <div
          className="mt-5 rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
          style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
        >
          {saveError}
        </div>
      )}

      {/* Appearance */}
      <SettingsSection label="Appearance">
        <SettingsRow icon={Sun} label="Theme" hint="System follows your device's light/dark preference.">
          <div className="flex flex-wrap gap-1.5 mt-2">
            <SettingsChip active={settings.theme === "light"} onClick={() => onChange({ theme: "light" })}>Light</SettingsChip>
            <SettingsChip active={settings.theme === "dark"} onClick={() => onChange({ theme: "dark" })}>Dark</SettingsChip>
            <SettingsChip active={settings.theme === "system"} onClick={() => onChange({ theme: "system" })}>System</SettingsChip>
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Workout Behavior */}
      <SettingsSection label="Workout Behavior">
        <SettingsRow icon={Flame} label="Show level-up alerts" hint="Hides the “Ready to level up” pills, the bumped-from indicators in active workouts, and the level-up dots on past sessions. Progression math still runs.">
          <ToggleSwitch
            on={settings.showLevelUpAlerts}
            onChange={(v) => onChange({ showLevelUpAlerts: v })}
            ariaLabel="Show level-up alerts"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Home Stats */}
      <SettingsSection label="Home Stats" hint="Toggling a stat off shows “—” instead of the number; the tile keeps its place.">
        <SettingsRow icon={TrendingUp} label="Show Volume">
          <ToggleSwitch
            on={settings.visibleHomeStats.volume}
            onChange={(v) => onChange({ visibleHomeStats: { volume: v } })}
            ariaLabel="Show Volume"
          />
        </SettingsRow>
        <SettingsRow icon={Activity} label="Show Sets">
          <ToggleSwitch
            on={settings.visibleHomeStats.sets}
            onChange={(v) => onChange({ visibleHomeStats: { sets: v } })}
            ariaLabel="Show Sets"
          />
        </SettingsRow>
        <SettingsRow icon={ListChecks} label="Show Reps">
          <ToggleSwitch
            on={settings.visibleHomeStats.reps}
            onChange={(v) => onChange({ visibleHomeStats: { reps: v } })}
            ariaLabel="Show Reps"
          />
        </SettingsRow>
      </SettingsSection>

      {/* Defaults */}
      <SettingsSection label="Defaults">
        <SettingsRow icon={Ruler} label="Default unit for new exercises" hint="Pre-fills the Unit field on the new-exercise form. You can still override per-exercise.">
          <div className="flex gap-1.5 mt-2">
            <SettingsChip active={settings.defaultUnit === "lb"} onClick={() => onChange({ defaultUnit: "lb" })}>lb</SettingsChip>
            <SettingsChip active={settings.defaultUnit === "kg"} onClick={() => onChange({ defaultUnit: "kg" })}>kg</SettingsChip>
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Account */}
      <SettingsSection label="Account">
        <button
          onClick={async () => {
            if (!confirmSignOut) {
              setConfirmSignOut(true);
              return;
            }
            await signOut();
          }}
          className="w-full p-4 flex items-center gap-3 transition text-left hover:bg-navy-50"
          style={{ borderTop: "0" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
            <LogOut size={18} className="text-navy-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy-900">{confirmSignOut ? "Tap to confirm sign out" : "Sign out"}</div>
            <div className="text-xs text-navy-500 mt-0.5">
              {confirmSignOut ? "Your data is safe — sign back in any time." : "Sign out of Spotter on this device."}
            </div>
          </div>
        </button>
        <button
          onClick={onDeleteAccount}
          className="w-full p-4 flex items-center gap-3 transition text-left hover:bg-navy-50 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--destructive-bg)" }}>
            <AlertTriangle size={18} style={{ color: "var(--destructive)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold" style={{ color: "var(--destructive)" }}>Delete account</div>
            <div className="text-xs text-navy-500 mt-0.5">Permanently remove your data from Spotter.</div>
          </div>
          <ChevronRight size={16} className="text-navy-300 shrink-0" />
        </button>
      </SettingsSection>

      {/* About */}
      <SettingsSection label="About">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
            <Sparkles size={18} className="text-navy-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-navy-900">Spotter</div>
            <div className="text-xs text-navy-500 mt-0.5 mono">version {APP_VERSION}</div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ label, hint, children }) {
  return (
    <div className="mt-7">
      <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">{label}</div>
      <div className="surface border border-soft card-shadow rounded-2xl divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {children}
      </div>
      {hint && <div className="text-[11px] text-navy-400 leading-relaxed mt-2 px-1">{hint}</div>}
    </div>
  );
}

function SettingsRow({ icon: Icon, label, hint, children }) {
  return (
    <div className="p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-50)" }}>
        <Icon size={18} className="text-navy-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-navy-900">{label}</div>
        {hint && <div className="text-xs text-navy-500 mt-0.5 leading-relaxed">{hint}</div>}
        {children}
      </div>
    </div>
  );
}

function SettingsChip({ active, onClick, children }) {
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

// Toggle switch — visual swap at ~10% scale of an iOS-style switch.
// Tappable on the whole element. Uses --toggle-on so dark mode can
// flip from "navy" to "accent orange" without redefining navy-900
// itself (which doubles as the body text color and would inappropriately
// brighten the on-state in dark mode).
function ToggleSwitch({ on, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      className="shrink-0 w-11 h-6 rounded-full relative transition"
      style={{ background: on ? "var(--toggle-on)" : "var(--border-strong)" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
        style={{
          left: on ? "calc(100% - 1.375rem)" : "0.125rem",
          background: "var(--toggle-knob)",
        }}
      />
    </button>
  );
}

// --- DELETE ACCOUNT FLOW ---
// Two-step confirmation: an explicit warning, then a re-auth prompt that
// verifies the user can sign in with their current credentials before we
// run any DELETE. Re-auth uses signInWithPassword — Supabase happily
// re-authenticates a user who's already signed in, returning success or
// an "Invalid login credentials" error we can surface inline.
function DeleteAccountView({ email: initialEmail, onCancel, onDelete, deleteError }) {
  const [step, setStep] = useState("warn"); // 'warn' | 'reauth'
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (step === "warn") {
    return (
      <div className="px-5 pb-28">
        <div className="mt-7 surface border border-soft card-shadow rounded-2xl p-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--destructive-bg)" }}>
            <AlertTriangle size={22} style={{ color: "var(--destructive)" }} />
          </div>
          <div className="serif text-2xl text-navy-900 mb-2" style={{ fontWeight: 500 }}>Delete your Spotter account?</div>
          <div className="text-sm text-navy-600 leading-relaxed">
            This permanently removes your profile, exercises you've created, plans, and all workout history. This cannot be undone.
          </div>
          <div className="text-xs text-navy-500 mt-3 leading-relaxed">
            The public exercise catalog stays available — only the rows you own get deleted.
          </div>
        </div>
        <BottomBar>
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
          <button
            onClick={() => setStep("reauth")}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition"
            style={{ background: "var(--destructive)" }}
          >
            Continue
          </button>
        </BottomBar>
      </div>
    );
  }

  // step === "reauth"
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setAuthError(error.message || "Couldn't verify your credentials.");
      return;
    }
    // Credentials valid — proceed with the actual deletion.
    const ok = await onDelete();
    setSubmitting(false);
    // On success App's signOut path takes over (component unmounts as
    // the auth gate flips). On failure, deleteError surfaces from the
    // parent below.
    if (!ok) {
      // Stay on this screen so the user sees the error.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-5 pb-28">
      <div className="mt-7 surface border border-soft card-shadow rounded-2xl p-5 space-y-4">
        <div className="text-sm text-navy-700 leading-relaxed">
          Re-enter your password to confirm. We don't ask for it elsewhere — this is a one-time check before deletion.
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Email</div>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Password</div>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900"
          />
        </div>
        {(authError || deleteError) && (
          <div
            className="rounded-xl px-3 py-2.5 text-xs leading-relaxed border"
            style={{ background: "var(--destructive-bg)", borderColor: "var(--destructive-border)", color: "var(--destructive)" }}
          >
            {authError || deleteError}
          </div>
        )}
      </div>
      <BottomBar>
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm disabled:opacity-60">Cancel</button>
        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition"
          style={{ background: "var(--destructive)" }}
        >
          {submitting ? "Deleting…" : "Delete account"}
        </button>
      </BottomBar>
    </form>
  );
}
