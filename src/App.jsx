import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  TrendingUp, Plus, Check, ChevronRight, Dumbbell, Clock, Flame, ArrowUp, Minus,
  Play, X, Edit3, History, ListChecks, Heart, Home, Trash2, ChevronLeft, GripVertical,
  Activity, Footprints, Trophy, Scale, Search, Library, Sparkles,
  User, Mail, Calendar, Ruler, Target, Download, Camera, LogOut, Settings
} from "lucide-react";
import { useLocalStorage } from "./hooks/useLocalStorage";

// --- SEED EXERCISES ---
const seedExercises = [
  { id: "ex-bench", name: "Bench Press", targetReps: [8, 12], unit: "lb", muscle: "Chest", equipment: "Barbell", bumpRule: "all", increment: 5 },
  { id: "ex-incdb", name: "Incline Dumbell Press", targetReps: [10, 15], unit: "lb", muscle: "Chest", equipment: "Dumbbell", bumpRule: "majority", increment: 2.5 },
  { id: "ex-tri", name: "Cable Tricep Extension", targetReps: [10, 12], unit: "lb", muscle: "Triceps", equipment: "Cable", bumpRule: "majority", increment: 2.5 },
  { id: "ex-rows", name: "Cable Rows", targetReps: [10, 15], unit: "lb", muscle: "Back", equipment: "Cable", bumpRule: "all", increment: 5 },
  { id: "ex-curl", name: "Dumbbell Curls", targetReps: [12, 15], unit: "lb", muscle: "Biceps", equipment: "Dumbbell", bumpRule: "majority", increment: 2.5 },
  { id: "ex-lat", name: "Lat Pulldowns", targetReps: [8, 12], unit: "lb", muscle: "Back", equipment: "Cable", bumpRule: "all", increment: 5 },
  { id: "ex-hammer", name: "Hammer Curls", targetReps: [12, 15], unit: "lb", muscle: "Biceps", equipment: "Dumbbell", bumpRule: "majority", increment: 2.5 },
  { id: "ex-seated", name: "Seated Dumbell Press", targetReps: [8, 12], unit: "lb", muscle: "Shoulders", equipment: "Dumbbell", bumpRule: "all", increment: 2.5 },
  { id: "ex-lateral", name: "Lateral Raises", targetReps: [12, 15], unit: "lb", muscle: "Shoulders", equipment: "Dumbbell", bumpRule: "majority", increment: 2.5 },
  { id: "ex-face", name: "Face Pulls", targetReps: [12, 15], unit: "lb", muscle: "Shoulders", equipment: "Cable", bumpRule: "majority", increment: 5 },
];

const seedHistory = [
  { id: 1, date: "2026-04-28T18:30:00", exercise: "Bench Press", weight: 165, reps: [8, 6, 4], targetReps: [8, 12], unit: "lb", workoutId: "w1" },
  { id: 2, date: "2026-04-28T18:45:00", exercise: "Incline Dumbell Press", weight: 35, reps: [18, 14, 12], targetReps: [10, 15], unit: "lb", note: "3 from flat", workoutId: "w1" },
  { id: 3, date: "2026-04-28T19:00:00", exercise: "Cable Tricep Extension", weight: 45, reps: [11, 10, 11], targetReps: [10, 12], unit: "lb", workoutId: "w1" },
  { id: 4, date: "2026-04-26T17:15:00", exercise: "Cable Rows", weight: 120, reps: [18, 14, 13], targetReps: [10, 15], unit: "lb", workoutId: "w2" },
  { id: 5, date: "2026-04-26T17:30:00", exercise: "Dumbbell Curls", weight: 30, reps: [40, 30, 26], targetReps: [12, 15], unit: "lb", workoutId: "w2" },
  { id: 6, date: "2026-04-26T17:45:00", exercise: "Lat Pulldowns", weight: 120, reps: [12, 11, 10], targetReps: [8, 12], unit: "lb", workoutId: "w2" },
  { id: 7, date: "2026-04-26T18:00:00", exercise: "Hammer Curls", weight: 30, reps: [30, 20], targetReps: [12, 15], unit: "lb", workoutId: "w2" },
  { id: 8, date: "2026-04-24T19:00:00", exercise: "Seated Dumbell Press", weight: 35, reps: [16, 13, 11], targetReps: [8, 12], unit: "lb", workoutId: "w3" },
  { id: 9, date: "2026-04-24T19:15:00", exercise: "Lateral Raises", weight: 17.5, reps: [18, 15, 16], targetReps: [12, 15], unit: "lb", workoutId: "w3" },
  { id: 10, date: "2026-04-24T19:30:00", exercise: "Face Pulls", weight: 105, reps: [16, 15], targetReps: [12, 15], unit: "lb", workoutId: "w3" },
  { id: 11, date: "2026-04-22T18:00:00", exercise: "Bench Press", weight: 160, reps: [10, 8, 7], targetReps: [8, 12], unit: "lb", workoutId: "w4" },
  { id: 12, date: "2026-04-19T17:00:00", exercise: "Bench Press", weight: 160, reps: [9, 7, 6], targetReps: [8, 12], unit: "lb", workoutId: "w5" },
];

const seedSessions = [
  { id: "w1", startedAt: "2026-04-28T18:30:00", endedAt: "2026-04-28T19:25:00", name: "Push Day" },
  { id: "w2", startedAt: "2026-04-26T17:15:00", endedAt: "2026-04-26T18:20:00", name: "Pull Day" },
  { id: "w3", startedAt: "2026-04-24T19:00:00", endedAt: "2026-04-24T19:55:00", name: "Shoulders" },
  { id: "w4", startedAt: "2026-04-22T18:00:00", endedAt: "2026-04-22T19:00:00", name: "Push Day" },
  { id: "w5", startedAt: "2026-04-19T17:00:00", endedAt: "2026-04-19T18:05:00", name: "Push Day" },
];

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

// --- ROOT ---
export default function App() {
  const [history, setHistory] = useLocalStorage("history", seedHistory);
  const [sessions, setSessions] = useLocalStorage("sessions", seedSessions);
  const [plans, setPlans] = useLocalStorage("plans", seedPlans);
  const [exercises, setExercises] = useLocalStorage("exercises", seedExercises);
  const [profile, setProfile] = useLocalStorage("profile", {
    id: "u1",
    name: "Mackenzie Clark",
    email: "cmac0792@gmail.com",
    photo: null, // base64 or null — falls back to initials
    dateOfBirth: "1992-07-15",
    heightCm: 180,
    weightKg: 84,
    gender: "Male",
    goal: "Hypertrophy",
    homeGym: "",
    units: "imperial", // imperial | metric
    memberSince: new Date().toISOString().split("T")[0],
  });
  const [tab, setTab] = useState("home");
  // Navigation is a stack: each pushView appends, popView trims the last entry,
  // resetView clears it. The current view is the top of the stack (or null when
  // the user is sitting on a top-level tab).
  const [viewStack, setViewStack] = useState([]);
  const view = viewStack[viewStack.length - 1] || null;
  const pushView = (v) => setViewStack(stack => [...stack, v]);
  const popView = () => setViewStack(stack => stack.slice(0, -1));
  const resetView = () => setViewStack([]);
  const [activeWorkout, setActiveWorkout] = useLocalStorage("activeWorkout", null);

  // If we have an active workout when the app loads, drop the user back into it
  useEffect(() => {
    if (activeWorkout && viewStack.length === 0) {
      setViewStack([{ type: "workout" }]);
    }
    // Only run on mount — we want this exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastByExercise = useMemo(() => {
    const map = new Map();
    [...history].sort((a, b) => b.date.localeCompare(a.date)).forEach(entry => {
      if (!map.has(entry.exercise)) map.set(entry.exercise, entry);
    });
    return map;
  }, [history]);

  const recentExercisesList = useMemo(() => Array.from(lastByExercise.values()), [lastByExercise]);

  const recentSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [sessions]);

  const addExerciseToLibrary = (newEx) => {
    const ex = { id: `ex-${Date.now()}`, ...newEx };
    setExercises([...exercises, ex]);
    return ex;
  };

  const updateExerciseInLibrary = (id, patch) => {
    setExercises(exercises.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const deleteExerciseFromLibrary = (id) => {
    setExercises(exercises.filter(e => e.id !== id));
  };

  const startWorkout = (planExercises = null) => {
    const id = `w${Date.now()}`;
    setActiveWorkout({ id, startedAt: new Date().toISOString(), exercises: [], planQueue: planExercises || [] });
    // Workout is a top-level mode, not a child of whatever the user was browsing
    setViewStack([{ type: "workout" }]);
  };

  const finishWorkout = (workoutName) => {
    if (!activeWorkout || activeWorkout.exercises.length === 0) {
      setActiveWorkout(null); resetView(); return;
    }
    const completed = activeWorkout.exercises.filter(ex => ex.reps.some(r => r > 0));
    const newEntries = completed.map((ex, i) => ({
      id: Date.now() + i,
      date: new Date(new Date(activeWorkout.startedAt).getTime() + i * 60000).toISOString(),
      exercise: ex.exercise,
      weight: ex.weight,
      reps: ex.reps.filter(r => r > 0),
      targetReps: ex.targetReps,
      unit: ex.unit,
      note: ex.note || undefined,
      workoutId: activeWorkout.id,
    }));
    setHistory([...newEntries, ...history]);
    setSessions([{ id: activeWorkout.id, startedAt: activeWorkout.startedAt, endedAt: new Date().toISOString(), name: workoutName || "Workout" }, ...sessions]);
    setActiveWorkout(null); resetView(); setTab("home");
  };

  const cancelWorkout = () => { setActiveWorkout(null); resetView(); setTab("home"); };

  const updateSession = (sessionId, sessionPatch, updatedEntries) => {
    // sessionPatch: partial fields to update on the session (e.g. name)
    // updatedEntries: full replacement array of history entries for this session
    setSessions(sessions.map(s => s.id === sessionId ? { ...s, ...sessionPatch } : s));
    if (updatedEntries) {
      // Replace all entries for this session with the updated set
      setHistory([
        ...history.filter(h => h.workoutId !== sessionId),
        ...updatedEntries,
      ]);
    }
  };

  const deleteSession = (sessionId) => {
    setSessions(sessions.filter(s => s.id !== sessionId));
    setHistory(history.filter(h => h.workoutId !== sessionId));
    popView();
  };

  const savePlan = (plan) => {
    if (plan.id) setPlans(plans.map(p => p.id === plan.id ? plan : p));
    else setPlans([...plans, { ...plan, id: `p${Date.now()}` }]);
    popView();
  };
  const deletePlan = (id) => { setPlans(plans.filter(p => p.id !== id)); popView(); };

  const renderingWorkout = view?.type === "workout";
  const renderingDetail = view && !renderingWorkout;

  return (
    <div className="min-h-screen text-navy-900" style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      background: "linear-gradient(180deg, #fafbfd 0%, #f1f4f9 100%)",
      color: "#0a1f3d",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        :root {
          --navy-950: #050d1f;
          --navy-900: #0a1f3d;
          --navy-800: #122b54;
          --navy-700: #1a3a6e;
          --navy-600: #254a85;
          --navy-500: #3a64a8;
          --navy-400: #6588c4;
          --navy-300: #9bb5d9;
          --navy-200: #c8d6ea;
          --navy-100: #e4ecf7;
          --navy-50: #f1f4f9;
          --bg: #fafbfd;
          --surface: #ffffff;
          --surface-2: #f6f8fc;
          --border: #e1e7f1;
          --border-strong: #d2dceb;
          --accent: #c89945;
          --success: #1f8a5f;
          --warning: #c4751c;
        }
        .mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum' on; }
        .serif { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .surface { background: var(--surface); }
        .surface-2 { background: var(--surface-2); }
        .text-navy-900 { color: var(--navy-900); }
        .text-navy-700 { color: var(--navy-700); }
        .text-navy-500 { color: var(--navy-500); }
        .text-navy-400 { color: var(--navy-400); }
        .text-navy-300 { color: var(--navy-300); }
        .bg-navy-900 { background: var(--navy-900); }
        .bg-navy-50 { background: var(--navy-50); }
        .bg-navy-100 { background: var(--navy-100); }
        .border-soft { border-color: var(--border); }
        .border-strong { border-color: var(--border-strong); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .card-shadow { box-shadow: 0 1px 2px rgba(10, 31, 61, 0.04), 0 1px 1px rgba(10, 31, 61, 0.02); }
        .card-shadow-lg { box-shadow: 0 4px 16px rgba(10, 31, 61, 0.08), 0 1px 3px rgba(10, 31, 61, 0.04); }
        .navy-shadow { box-shadow: 0 8px 24px rgba(10, 31, 61, 0.18), 0 2px 6px rgba(10, 31, 61, 0.1); }
        input, textarea {
          caret-color: var(--navy-900);
        }
        input::selection, textarea::selection {
          background: var(--navy-200);
          color: var(--navy-900);
        }
        .grain {
          position: relative;
        }
        .grain::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 20% 30%, rgba(37, 74, 133, 0.04) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(37, 74, 133, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }
      `}</style>

      <div className="max-w-md mx-auto min-h-screen relative grain" style={{ background: "var(--bg)" }}>
        <Header
          tab={tab}
          view={view}
          activeWorkout={activeWorkout}
          profile={profile}
          onBack={popView}
          onCancelWorkout={cancelWorkout}
          onOpenProfile={() => pushView({ type: "profile" })}
        />

        {!renderingDetail && !renderingWorkout && (
          <>
            {tab === "home" && (
              <HomeView
                recentSessions={recentSessions}
                recentExercisesList={recentExercisesList}
                history={history}
                plans={plans}
                exercises={exercises}
                onStartBlank={() => startWorkout()}
                onStartFromPlan={(plan) => startWorkout(plan.exercises)}
                onSelectExercise={(name) => pushView({ type: "exercise", name })}
                onSelectSession={(id) => pushView({ type: "session", id })}
                onOpenLibrary={() => pushView({ type: "library" })}
              />
            )}
            {tab === "past" && (
              <PastView sessions={sessions} history={history} onSelectSession={(id) => pushView({ type: "session", id })} />
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
          />
        )}
        {view?.type === "session" && (
          <SessionDetailView
            session={sessions.find(s => s.id === view.id)}
            entries={history.filter(h => h.workoutId === view.id).sort((a,b) => a.date.localeCompare(b.date))}
            onUpdate={updateSession}
            onDelete={deleteSession}
          />
        )}
        {view?.type === "plan-edit" && (
          <PlanEditView plan={view.id ? plans.find(p => p.id === view.id) : null} exercises={exercises} lastByExercise={lastByExercise} onSave={savePlan} onDelete={deletePlan} onCancel={popView} onCreateExercise={addExerciseToLibrary} />
        )}
        {view?.type === "library" && (
          <LibraryView exercises={exercises} lastByExercise={lastByExercise} onCreate={() => pushView({ type: "exercise-edit", id: null })} onEdit={(id) => pushView({ type: "exercise-edit", id })} onSelect={(name) => pushView({ type: "exercise", name })} />
        )}
        {view?.type === "exercise-edit" && (
          <ExerciseEditView
            exercise={view.id ? exercises.find(e => e.id === view.id) : null}
            initialName={view.initialName}
            onSave={(ex) => {
              if (ex.id) updateExerciseInLibrary(ex.id, ex);
              else addExerciseToLibrary(ex);
              popView();
            }}
            onDelete={(id) => { deleteExerciseFromLibrary(id); popView(); }}
            onCancel={popView}
          />
        )}
        {view?.type === "profile" && (
          <ProfileView
            profile={profile}
            sessions={sessions}
            history={history}
            onEdit={() => pushView({ type: "profile-edit" })}
          />
        )}
        {view?.type === "profile-edit" && (
          <ProfileEditView
            profile={profile}
            onSave={(p) => { setProfile(p); popView(); }}
            onCancel={popView}
          />
        )}
        {renderingWorkout && activeWorkout && (
          <WorkoutView workout={activeWorkout} setWorkout={setActiveWorkout} exercises={exercises} lastByExercise={lastByExercise} onCreateExercise={addExerciseToLibrary} onFinish={finishWorkout} />
        )}

        {!renderingWorkout && !renderingDetail && <TabBar tab={tab} onChange={(t) => { setTab(t); resetView(); }} />}
      </div>
    </div>
  );
}

// --- HEADER ---
function Header({ tab, view, activeWorkout, profile, onBack, onCancelWorkout, onOpenProfile }) {
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
  if (view?.type === "workout") { label = "Active Session"; title = <WorkoutTimer startedAt={activeWorkout?.startedAt} />; titleClass = "mono"; }

  const showBack = view && view.type !== "workout";
  const showProfileBubble = view?.type !== "workout" && view?.type !== "profile" && view?.type !== "profile-edit";

  return (
    <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-soft pt-safe" style={{ background: "rgba(250, 251, 253, 0.85)" }}>
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3">
        {showBack && (
          <button onClick={onBack} className="w-9 h-9 -ml-2 flex items-center justify-center text-navy-500 hover:text-navy-900 shrink-0 transition">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-400 mono font-medium">{label}</div>
          <h1 className={`text-[26px] font-semibold tracking-tight mt-0.5 truncate text-navy-900 ${titleClass}`} style={{ fontWeight: titleClass === "serif" ? 500 : 600 }}>
            {title}
          </h1>
        </div>
        {view?.type === "workout" && (
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
        background: profile.photo ? "transparent" : "linear-gradient(135deg, var(--navy-700) 0%, var(--navy-900) 100%)",
        borderColor: "var(--surface)",
        boxShadow: "0 0 0 1px var(--border-strong), 0 1px 3px rgba(10, 31, 61, 0.1)",
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
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="max-w-md mx-auto backdrop-blur-xl border-t border-soft px-2 pb-safe" style={{ background: "rgba(255, 255, 255, 0.92)" }}>
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
    </div>
  );
}

// --- HOME ---
function HomeView({ recentSessions, recentExercisesList, history, plans, exercises, onStartBlank, onStartFromPlan, onSelectSession, onOpenLibrary }) {
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="px-5 pb-28">
      {/* Hero greeting */}
      <div className="mt-7">
        <div className="text-[11px] uppercase tracking-[0.2em] text-navy-400 mono font-medium">{greeting}</div>
        <div className="serif text-[28px] leading-tight text-navy-900 mt-1" style={{ fontWeight: 500, letterSpacing: "-0.02em" }}>
          Let's get to <em style={{ fontStyle: "italic" }}>work.</em>
        </div>
      </div>

      {/* Hero start button */}
      <button
        onClick={() => plans.length > 0 ? setShowPlanPicker(true) : onStartBlank()}
        className="mt-5 w-full bg-navy-900 text-white py-6 rounded-3xl font-semibold text-base flex items-center justify-center gap-2.5 navy-shadow active:scale-[0.98] transition"
        style={{ background: "var(--navy-900)" }}
      >
        <Play size={20} strokeWidth={2.5} fill="currentColor" />
        Start Workout
      </button>

      {showPlanPicker && (
        <div className="fixed inset-0 z-30 bg-navy-900/30 backdrop-blur-sm flex items-end justify-center" style={{ background: "rgba(10, 31, 61, 0.35)" }} onClick={() => setShowPlanPicker(false)}>
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

      {/* Level up alerts */}
      <LevelUpAlerts recentExercisesList={recentExercisesList} exercises={exercises} />

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

function LevelUpAlerts({ recentExercisesList, exercises }) {
  const libByName = useMemo(() => {
    const m = new Map();
    exercises.forEach(e => m.set(e.name, e));
    return m;
  }, [exercises]);

  const readyToBump = recentExercisesList.filter(e => getProgressionStatus(e, libByName.get(e.exercise))?.status === "bump");
  if (readyToBump.length === 0) return null;

  return (
    <div className="mt-7">
      <div className="flex items-center gap-1.5 mb-2">
        <Flame size={13} style={{ color: "var(--accent)" }} />
        <div className="text-[10px] uppercase tracking-[0.18em] mono font-semibold" style={{ color: "var(--accent)" }}>
          Time to level up
        </div>
      </div>
      <div className="space-y-2">
        {readyToBump.slice(0, 3).map(entry => {
          const libEx = libByName.get(entry.exercise);
          const weighted = tracksWeightFor(libEx);
          return (
            <div
              key={entry.id}
              className="w-full rounded-2xl p-4 flex items-center justify-between border"
              style={{
                background: "linear-gradient(135deg, #fbf3e0 0%, #fef9ee 100%)",
                borderColor: "rgba(200, 153, 69, 0.25)",
              }}
            >
              <div className="text-left">
                <div className="font-semibold text-navy-900">{entry.exercise}</div>
                <div className="text-xs text-navy-600 mt-0.5">
                  {weighted ? (
                    <>Try <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{suggestedNextWeight(entry, libEx)} {entry.unit}</span> next session</>
                  ) : (
                    <>Hit <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{suggestedNextReps(entry)}+ reps</span> next session</>
                  )}
                </div>
              </div>
              <ArrowUp size={20} style={{ color: "var(--accent)" }} />
            </div>
          );
        })}
      </div>
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
                      <span>{ex.targetReps[0]}–{ex.targetReps[1]} reps</span>
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
        style={{ background: "var(--navy-900)" }}
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
        background: active ? "var(--navy-900)" : "var(--surface)",
        color: active ? "white" : "var(--navy-600)",
        borderColor: active ? "var(--navy-900)" : "var(--border)",
      }}
    >
      {children}
    </button>
  );
}

// --- EXERCISE EDIT ---
function ExerciseEditView({ exercise, initialName, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(exercise?.name || initialName || "");
  const [muscle, setMuscle] = useState(exercise?.muscle || "Chest");
  const [equipment, setEquipment] = useState(exercise?.equipment || "Barbell");
  const [minReps, setMinReps] = useState(exercise?.targetReps[0] ?? 8);
  const [maxReps, setMaxReps] = useState(exercise?.targetReps[1] ?? 12);
  const [unit, setUnit] = useState(exercise?.unit || "lb");
  const [tracksWeight, setTracksWeight] = useState(exercise ? exercise.tracksWeight !== false : true);
  const [bumpRule, setBumpRule] = useState(exercise?.bumpRule || "all");
  const [increment, setIncrement] = useState(exercise?.increment ?? 5);

  const canSave = name.trim() && minReps > 0 && maxReps >= minReps && (!tracksWeight || increment > 0);

  const ruleDescription = {
    all: `every set hits ${maxReps}+ reps`,
    majority: `most sets hit ${maxReps}+ reps`,
    any: `any one set hits ${maxReps}+ reps`,
  }[bumpRule];

  return (
    <div className="px-5 pb-32">
      <div className="mt-5 space-y-4">
        <Field label="Exercise name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Romanian Deadlift" autoFocus={!exercise} className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
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

        <Field label="Target rep range">
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" value={minReps} onChange={e => setMinReps(parseInt(e.target.value) || 0)} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
            <span className="text-navy-400">–</span>
            <input type="number" inputMode="numeric" value={maxReps} onChange={e => setMaxReps(parseInt(e.target.value) || 0)} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
            <span className="text-sm text-navy-500">reps</span>
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
                    value={increment}
                    onChange={e => setIncrement(parseFloat(e.target.value) || 0)}
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
                  <span className="mono font-semibold" style={{ color: "var(--accent)" }}>{maxReps} reps</span> next session.</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {exercise && (
        <button onClick={() => onDelete(exercise.id)} className="mt-8 w-full text-red-600 hover:text-red-700 py-3 text-sm font-medium flex items-center justify-center gap-2">
          <Trash2 size={14} /> Delete exercise
        </button>
      )}

      <BottomBar>
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
        <button
          onClick={() => canSave && onSave({ id: exercise?.id, name: name.trim(), muscle, equipment, targetReps: [minReps, maxReps], unit, tracksWeight, bumpRule, increment })}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition"
          style={{ background: "var(--navy-900)" }}
        >
          Save
        </button>
      </BottomBar>
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
        borderColor: active ? "var(--navy-900)" : "var(--border-strong)",
        background: active ? "var(--navy-900)" : "transparent",
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
  return (
    <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-soft" style={{ background: "rgba(255, 255, 255, 0.92)" }}>
      <div className="max-w-md mx-auto px-5 py-3 flex gap-2">{children}</div>
    </div>
  );
}

// --- PAST WORKOUTS ---
function PastView({ sessions, history, onSelectSession }) {
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

  return (
    <div className="px-5 pb-28">
      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatTile label="This month" value={totalThisMonth} unit="sessions" />
        <StatTile label="Total" value={sessions.length} unit="sessions" />
        <StatTile label="Avg duration" value="58" unit="min" />
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

function SessionDetailView({ session, entries, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(session?.name || "");
  const [draftEntries, setDraftEntries] = useState(entries);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset drafts when session/entries change or when leaving edit mode
  useEffect(() => {
    setDraftName(session?.name || "");
    setDraftEntries(entries);
  }, [session?.id, editing]);

  // Auto-cancel delete confirmation
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  if (!session) return null;
  const duration = Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 60000);
  const displayEntries = editing ? draftEntries : entries;
  const totalReps = displayEntries.reduce((acc, e) => acc + e.reps.reduce((a, b) => a + b, 0), 0);

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

  const handleSave = () => {
    // Filter out any entries that ended up with no reps (e.g. all sets removed)
    const cleaned = draftEntries
      .map(e => ({ ...e, reps: e.reps.filter(r => r > 0) }))
      .filter(e => e.reps.length > 0);
    onUpdate(session.id, { name: draftName.trim() || "Workout" }, cleaned);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  return (
    <div className="px-5 pb-32">
      {/* Hero card */}
      <div className="mt-5 rounded-2xl p-5 card-shadow-lg border border-soft" style={{ background: "linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 100%)" }}>
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
          <SessionStat label="Duration" value={`${duration}m`} />
          <SessionStat label="Exercises" value={displayEntries.length} />
          <SessionStat label="Total reps" value={totalReps} />
        </div>
      </div>

      {/* Action bar */}
      {!editing ? (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="flex-1 surface border border-soft text-navy-700 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-navy-50 transition"
          >
            <Edit3 size={13} /> Edit
          </button>
          <button
            onClick={() => {
              if (confirmDelete) onDelete(session.id);
              else setConfirmDelete(true);
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition border"
            style={{
              borderColor: confirmDelete ? "#dc2626" : "var(--border)",
              color: confirmDelete ? "#dc2626" : "var(--navy-700)",
              background: confirmDelete ? "rgba(220, 38, 38, 0.05)" : "var(--surface)",
            }}
          >
            <Trash2 size={13} /> {confirmDelete ? "Tap to confirm" : "Delete"}
          </button>
        </div>
      ) : (
        <div className="mt-4 surface-2 border border-soft rounded-xl p-3 text-xs text-navy-600 leading-relaxed">
          You're editing this workout. Changes save when you tap Done.
        </div>
      )}

      {/* Exercises */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Exercises</div>
        <div className="space-y-2">
          {displayEntries.map(entry => (
            editing ? (
              <EditableEntry
                key={entry.id}
                entry={entry}
                onWeightChange={(weight) => updateEntry(entry.id, { weight })}
                onRepsChange={(setIdx, value) => updateEntryReps(entry.id, setIdx, value)}
                onNoteChange={(note) => updateEntry(entry.id, { note })}
                onAddSet={() => addEntrySet(entry.id)}
                onRemoveSet={(setIdx) => removeEntrySet(entry.id, setIdx)}
                onRemoveEntry={() => removeEntry(entry.id)}
              />
            ) : (
              <div key={entry.id} className="surface border border-soft card-shadow rounded-xl p-4">
                <div className="font-semibold text-navy-900 mb-2">{entry.exercise}</div>
                <div className="flex items-baseline gap-2">
                  {entry.weight > 0 ? (
                    <>
                      <div className="text-2xl font-semibold mono text-navy-900">{entry.weight}</div>
                      <div className="text-navy-400 text-xs mono">{entry.unit}</div>
                      <div className="text-navy-300 mono">×</div>
                      <div className="text-navy-700 mono text-sm">{entry.reps.join(" · ")}</div>
                    </>
                  ) : (
                    <div className="text-2xl font-semibold mono text-navy-900">{entry.reps.join(" · ")}</div>
                  )}
                </div>
                {entry.note && <div className="mt-2 text-xs text-navy-500 italic">"{entry.note}"</div>}
              </div>
            )
          ))}
          {editing && displayEntries.length === 0 && (
            <div className="surface border border-dashed border-strong rounded-xl p-6 text-center text-sm text-navy-500">
              All exercises removed. The workout will be deleted when you save.
            </div>
          )}
        </div>
      </div>

      {/* Save/cancel bar in edit mode */}
      {editing && (
        <BottomBar>
          <button onClick={handleCancelEdit} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              if (draftEntries.filter(e => e.reps.some(r => r > 0)).length === 0) {
                onDelete(session.id);
              } else {
                handleSave();
              }
            }}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition"
            style={{ background: "var(--navy-900)" }}
          >
            Done
          </button>
        </BottomBar>
      )}
    </div>
  );
}

function EditableEntry({ entry, onWeightChange, onRepsChange, onNoteChange, onAddSet, onRemoveSet, onRemoveEntry }) {
  const [showNote, setShowNote] = useState(!!entry.note);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightDraft, setWeightDraft] = useState(String(entry.weight));
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
          style={{ color: confirmRemove ? "#dc2626" : "var(--navy-400)" }}
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
              onKeyDown={e => {
                if (e.key === "Enter") e.target.blur();
                else if (e.key === "Escape") { setEditingWeight(false); setWeightDraft(String(entry.weight)); }
              }}
              className="w-20 surface-2 border border-soft rounded-lg px-2 py-1 text-base font-semibold mono text-center text-navy-900 focus:outline-none focus:border-strong"
            />
          ) : (
            <button
              onClick={() => { setWeightDraft(String(entry.weight)); setEditingWeight(true); }}
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
                placeholder="0"
                className="w-16 surface-2 border border-soft rounded-md px-2 py-1.5 text-sm font-semibold mono text-center text-navy-900 focus:outline-none focus:border-strong"
              />
              <span className="text-xs text-navy-400">reps</span>
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
  return (
    <div className="px-5 pb-28">
      <button onClick={onCreate} className="mt-5 w-full surface border border-dashed border-strong text-navy-700 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-navy-50 transition">
        <Plus size={16} />
        Create new plan
      </button>

      <div className="mt-6 text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">Your plans</div>
      {plans.length === 0 ? (
        <div className="surface border border-soft rounded-xl p-8 text-center">
          <ListChecks size={24} className="text-navy-300 mx-auto mb-2" />
          <div className="text-sm text-navy-500">No plans yet</div>
        </div>
      ) : (
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
      )}
    </div>
  );
}

function PlanEditView({ plan, exercises, lastByExercise, onSave, onDelete, onCancel, onCreateExercise }) {
  const [name, setName] = useState(plan?.name || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [planExercises, setPlanExercises] = useState(plan?.exercises || []);
  const [showPicker, setShowPicker] = useState(false);

  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= planExercises.length) return;
    const newList = [...planExercises];
    [newList[idx], newList[target]] = [newList[target], newList[idx]];
    setPlanExercises(newList);
  };

  const remove = (idx) => setPlanExercises(planExercises.filter((_, i) => i !== idx));
  const addExisting = (name) => { setPlanExercises([...planExercises, name]); setShowPicker(false); };
  const handleCreateNew = (newName) => {
    const created = onCreateExercise({ name: newName, muscle: "Other", equipment: "Other", targetReps: [8, 12], unit: "lb", bumpRule: "all", increment: 5 });
    setPlanExercises([...planExercises, created.name]);
    setShowPicker(false);
  };

  const canSave = name.trim() && planExercises.length > 0;

  return (
    <div className="px-5 pb-32">
      {showPicker && (
        <ExerciseSearchSheet exercises={exercises} lastByExercise={lastByExercise} excluded={planExercises} onPick={addExisting} onCreateNew={handleCreateNew} onClose={() => setShowPicker(false)} />
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
        <button onClick={() => canSave && onSave({ id: plan?.id, name, description, exercises: planExercises })} disabled={!canSave} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition" style={{ background: "var(--navy-900)" }}>
          Save plan
        </button>
      </BottomBar>
    </div>
  );
}

// --- SHARED EXERCISE SEARCH SHEET ---
function ExerciseSearchSheet({ exercises, lastByExercise, excluded = [], onPick, onCreateNew, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return exercises
      .filter(e => !excluded.includes(e.name))
      .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  }, [exercises, search, excluded]);

  const exactMatch = filtered.some(e => e.name.toLowerCase() === search.toLowerCase().trim());
  const showCreate = search.trim().length > 0 && !exactMatch;

  return (
    <div className="fixed inset-0 z-30 backdrop-blur-sm" style={{ background: "rgba(10, 31, 61, 0.35)" }} onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 max-w-md mx-auto surface border-t border-soft rounded-t-3xl flex flex-col" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
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

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {showCreate && (
            <button
              onClick={() => onCreateNew(search.trim())}
              className="w-full mb-3 rounded-xl p-4 flex items-center gap-3 transition text-left border"
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
          )}

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
      </div>
    </div>
  );
}

// --- PROFILE ---
function ProfileView({ profile, sessions, history, onEdit }) {
  const initials = useMemo(() => profile.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(), [profile.name]);

  const memberFor = useMemo(() => {
    if (!profile.memberSince) return null;
    const days = Math.floor((Date.now() - new Date(profile.memberSince).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  }, [profile.memberSince]);

  const totalSets = history.reduce((acc, e) => acc + e.reps.length, 0);
  const totalReps = history.reduce((acc, e) => acc + e.reps.reduce((a, b) => a + b, 0), 0);

  // Total volume = sum of (weight × reps), normalized to the user's preferred unit
  // Each history entry has its own unit (lb or kg) so we convert before summing
  const totalVolume = useMemo(() => {
    const targetUnit = profile.units === "imperial" ? "lb" : "kg";
    return history.reduce((acc, entry) => {
      const entryReps = entry.reps.reduce((a, b) => a + b, 0);
      let weight = entry.weight;
      if (entry.unit !== targetUnit) {
        weight = entry.unit === "kg" ? weight * 2.205 : weight / 2.205;
      }
      return acc + weight * entryReps;
    }, 0);
  }, [history, profile.units]);

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
    const csv = buildCsv(sessions, history);
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
      <div className="mt-5 rounded-2xl p-6 card-shadow-lg" style={{ background: "linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 100%)" }}>
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

      {/* Details */}
      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">About</div>
        <div className="surface border border-soft card-shadow rounded-2xl divide-y" style={{ borderColor: "var(--border)" }}>
          <DetailRow icon={Mail} label="Email" value={profile.email} />
          <DetailRow icon={Calendar} label="Date of birth" value={profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} />
          <DetailRow icon={User} label="Gender" value={profile.gender || "—"} />
          <DetailRow icon={Dumbbell} label="Home gym" value={profile.homeGym?.trim() || "—"} />
          <DetailRow icon={Target} label="Goal" value={profile.goal || "—"} />
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

      {/* Footer note */}
      <div className="mt-8 text-[11px] text-navy-400 text-center leading-relaxed px-4">
        Multi-user support coming in a future update.
      </div>

      {/* CSV fallback modal — shown when direct download isn't available (sandboxed previews) */}
      {csvFallback && (
        <div className="fixed inset-0 z-30 backdrop-blur-sm flex items-end" style={{ background: "rgba(10, 31, 61, 0.45)" }} onClick={() => setCsvFallback(null)}>
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
                style={{ background: copied ? "var(--success)" : "var(--navy-900)" }}
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

function ProfileEditView({ profile, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...profile });
  const fileInputRef = useRef(null);

  const update = (patch) => setDraft({ ...draft, ...patch });

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

  return (
    <div className="px-5 pb-32">
      {/* Photo */}
      <div className="mt-5 flex flex-col items-center">
        <div
          className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center relative"
          style={{
            background: draft.photo ? "transparent" : "linear-gradient(135deg, var(--navy-700) 0%, var(--navy-900) 100%)",
            border: "3px solid var(--surface)",
            boxShadow: "0 0 0 1px var(--border-strong), 0 4px 12px rgba(10, 31, 61, 0.12)",
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

      <div className="mt-7 space-y-4">
        <Field label="Full name">
          <input value={draft.name} onChange={e => update({ name: e.target.value })} placeholder="Your name" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Email">
          <input type="email" value={draft.email || ""} onChange={e => update({ email: e.target.value })} placeholder="you@example.com" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Home gym" hint="Where you usually train — shown on your profile">
          <input value={draft.homeGym || ""} onChange={e => update({ homeGym: e.target.value })} placeholder="e.g. Synergy Health & Sports Performance" className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
        </Field>

        <Field label="Date of birth">
          <input type="date" value={draft.dateOfBirth || ""} onChange={e => update({ dateOfBirth: e.target.value })} className="w-full surface border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
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
              <input type="number" inputMode="numeric" value={heightFeet} onChange={e => setHeightFeet(e.target.value)} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">ft</span>
              <input type="number" inputMode="numeric" value={heightInches} onChange={e => setHeightInches(e.target.value)} className="w-20 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">in</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={draft.heightCm || ""} onChange={e => update({ heightCm: parseInt(e.target.value) || null })} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">cm</span>
            </div>
          )}
        </Field>

        <Field label="Weight">
          {draft.units === "imperial" ? (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" value={weightLb} onChange={e => setWeightLb(e.target.value)} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
              <span className="text-sm text-navy-500">lb</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" step="0.1" value={draft.weightKg || ""} onChange={e => update({ weightKg: parseFloat(e.target.value) || null })} className="w-24 surface border border-soft rounded-xl px-3 py-3 text-center text-base mono focus:outline-none focus:border-strong text-navy-900" />
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
      </div>

      <BottomBar>
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-soft text-navy-700 font-medium text-sm">Cancel</button>
        <button
          onClick={() => canSave && onSave(draft)}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-30 transition"
          style={{ background: "var(--navy-900)" }}
        >
          Save
        </button>
      </BottomBar>
    </div>
  );
}

// --- CSV EXPORT ---
function buildCsv(sessions, history) {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const rows = [];
  rows.push([
    "Date", "Time", "Workout name", "Exercise", "Set #",
    "Weight", "Unit", "Reps", "Note"
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
    entry.reps.forEach((reps, i) => {
      rows.push([
        dateStr, timeStr, workoutName, entry.exercise, i + 1,
        weightCell, unitCell, reps, entry.note || "",
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
      <div className="mt-5 rounded-2xl p-5 border border-soft card-shadow" style={{ background: "linear-gradient(135deg, #fbf3e0 0%, var(--surface) 100%)" }}>
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
function ExerciseDetailView({ entries, libEx }) {
  if (entries.length === 0) return null;
  const latest = entries[0];
  const prog = getProgressionStatus(latest, libEx);

  return (
    <div className="px-5 pb-20">
      <div className="mt-5 rounded-2xl p-5 card-shadow-lg" style={{ background: "linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 100%)" }}>
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
              <div className="text-xl font-semibold mt-0.5 mono text-white">{r}</div>
            </div>
          ))}
        </div>
        {latest.note && <div className="mt-3 text-xs text-white/70 italic">"{latest.note}"</div>}
        {prog && (
          <div className="mt-4 rounded-lg p-3 flex items-start gap-2.5" style={{ background: "rgba(255,255,255,0.08)" }}>
            {prog.status === "bump" && <Flame size={14} style={{ color: "#f0c674" }} className="mt-0.5 shrink-0" />}
            {prog.status === "hold" && <Minus size={14} className="text-white/60 mt-0.5 shrink-0" />}
            {prog.status === "progress" && <TrendingUp size={14} style={{ color: "#86d99e" }} className="mt-0.5 shrink-0" />}
            <div className="text-xs text-white/90 leading-relaxed">{prog.message}</div>
          </div>
        )}
      </div>

      <div className="mt-7">
        <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-3">History</div>
        <div className="space-y-2">
          {entries.map(entry => {
            const total = entry.reps.reduce((a, b) => a + b, 0);
            return (
              <div key={entry.id} className="surface border border-soft card-shadow rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-navy-500 mono">{formatDate(entry.date)}</div>
                  <div className="text-[10px] text-navy-300 mono">vol {total}</div>
                </div>
                <div className="flex items-baseline gap-2">
                  {entry.weight > 0 ? (
                    <>
                      <div className="text-2xl font-semibold mono text-navy-900">{entry.weight}</div>
                      <div className="text-navy-400 text-xs mono">{entry.unit}</div>
                      <div className="text-navy-300 mono">×</div>
                      <div className="text-navy-700 mono text-sm">{entry.reps.join(" · ")}</div>
                    </>
                  ) : (
                    <div className="text-2xl font-semibold mono text-navy-900">{entry.reps.join(" · ")}</div>
                  )}
                </div>
                {entry.note && <div className="mt-2 text-xs text-navy-500 italic">"{entry.note}"</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- ACTIVE WORKOUT ---
function WorkoutView({ workout, setWorkout, exercises, lastByExercise, onCreateExercise, onFinish }) {
  const [showPicker, setShowPicker] = useState(workout.exercises.length === 0 && workout.planQueue.length === 0);
  const [activeIdx, setActiveIdx] = useState(Math.max(0, workout.exercises.length - 1));
  const [showFinish, setShowFinish] = useState(false);
  const [workoutName, setWorkoutName] = useState("");

  useEffect(() => {
    if (workout.exercises.length === 0 && workout.planQueue.length > 0) {
      const queueExercises = workout.planQueue.map(name => {
        const last = lastByExercise.get(name);
        const libEx = exercises.find(e => e.name === name);
        return last ? buildExerciseFromHistory(last, libEx) : buildBlankExercise(name, libEx);
      });
      setWorkout({ ...workout, exercises: queueExercises, planQueue: [] });
      setActiveIdx(0);
    }
    // eslint-disable-next-line
  }, []);

  const addExercise = (exerciseName) => {
    const last = lastByExercise.get(exerciseName);
    const libEx = exercises.find(e => e.name === exerciseName);
    const newExercise = last ? buildExerciseFromHistory(last, libEx) : buildBlankExercise(exerciseName, libEx);
    const newExercises = [...workout.exercises, newExercise];
    setWorkout({ ...workout, exercises: newExercises });
    setActiveIdx(newExercises.length - 1);
    setShowPicker(false);
  };

  const handleCreateNew = (newName) => {
    const created = onCreateExercise({ name: newName, muscle: "Other", equipment: "Other", targetReps: [8, 12], unit: "lb", bumpRule: "all", increment: 5 });
    addExercise(created.name);
  };

  const updateExercise = (idx, patch) => {
    const updated = [...workout.exercises];
    updated[idx] = { ...updated[idx], ...patch };
    setWorkout({ ...workout, exercises: updated });
  };

  const removeExercise = (idx) => {
    const updated = workout.exercises.filter((_, i) => i !== idx);
    setWorkout({ ...workout, exercises: updated });
    // After removing, focus the previous exercise (or the new last one)
    if (activeIdx >= updated.length) {
      setActiveIdx(Math.max(0, updated.length - 1));
    } else if (idx <= activeIdx && activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
    }
    // If we just removed the last exercise, open the picker so the workout isn't empty
    if (updated.length === 0) setShowPicker(true);
  };

  if (showPicker) {
    return (
      <div className="px-5 pb-20 mt-5">
        <ExerciseSearchSheet exercises={exercises} lastByExercise={lastByExercise} excluded={workout.exercises.map(e => e.exercise)} onPick={addExercise} onCreateNew={handleCreateNew} onClose={() => workout.exercises.length > 0 && setShowPicker(false)} />
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
                onClick={() => setActiveIdx(i)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition font-medium"
                style={{
                  background: i === activeIdx ? "var(--navy-900)" : "var(--surface)",
                  color: i === activeIdx ? "white" : "var(--navy-600)",
                  borderColor: i === activeIdx ? "var(--navy-900)" : "var(--border)",
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
          onUpdate={(patch) => updateExercise(activeIdx, patch)}
          onRemove={() => removeExercise(activeIdx)}
        />
      )}

      <button onClick={() => setShowPicker(true)} className="mt-4 w-full surface-2 border border-dashed border-strong text-navy-600 py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-navy-50 transition">
        <Plus size={16} /> Add another exercise
      </button>

      {showFinish && (
        <div className="fixed inset-0 z-30 backdrop-blur-sm flex items-end" style={{ background: "rgba(10, 31, 61, 0.35)" }} onClick={() => setShowFinish(false)}>
          <div className="max-w-md w-full mx-auto surface border-t border-soft rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-strong)" }} />
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium mb-2">Name this workout</div>
            <input autoFocus value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="e.g. Push Day" className="w-full surface-2 border border-soft rounded-xl px-4 py-3 text-base focus:outline-none focus:border-strong text-navy-900" />
            <button onClick={() => onFinish(workoutName.trim() || "Workout")} className="mt-4 w-full text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition" style={{ background: "var(--success)" }}>
              <Check size={18} strokeWidth={2.5} /> Save workout
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-soft" style={{ background: "rgba(255, 255, 255, 0.92)" }}>
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
  // Bodyweight progression happens via reps, not weight, so don't pre-bump the weight value.
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
    increment: libEx?.increment ?? (sourceEntry.weight < 50 ? 2.5 : 5),
    reps: [0, 0, 0],
    note: "",
    bumped: weighted && prog?.status === "bump",
  };
}

function buildBlankExercise(name, libEx) {
  return {
    exercise: name, weight: 0, lastWeight: null, lastReps: [], lastDate: null,
    targetReps: libEx?.targetReps || [8, 12], unit: libEx?.unit || "lb",
    tracksWeight: tracksWeightFor(libEx),
    increment: libEx?.increment ?? 5,
    reps: [0, 0, 0], note: "", bumped: false,
  };
}

function ActiveExercise({ ex, onUpdate, onRemove }) {
  const isBodyweight = ex.tracksWeight === false;
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
    setWeightDraft(String(ex.weight));
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
        {ex.bumped && (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider mono font-semibold" style={{ color: "var(--accent)" }}>
            <Flame size={11} /> Bumped from {ex.lastWeight}{ex.unit}
          </div>
        )}
      </div>

      {ex.lastDate ? (
        <div className="surface border border-soft rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">Last time · {formatDate(ex.lastDate)}</div>
            <div className="text-xs mono text-navy-700">
              {ex.lastWeight > 0 ? `${ex.lastWeight}${ex.unit} × ` : ""}{ex.lastReps.join("/")}
            </div>
          </div>
        </div>
      ) : (
        <div className="surface border border-dashed border-strong rounded-xl p-3 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">No history — first time</div>
        </div>
      )}

      {showWeightCard ? (
        <div className="rounded-2xl p-5 card-shadow-lg" style={{ background: "linear-gradient(135deg, var(--navy-900) 0%, var(--navy-700) 100%)" }}>
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
          <div className="text-[10px] uppercase tracking-[0.18em] text-navy-500 mono font-medium">Sets · target {ex.targetReps[0]}–{ex.targetReps[1]} reps</div>
          {restTimer && (
            <button onClick={() => setRestTimer(null)} className="flex items-center gap-1.5 text-[10px] mono uppercase tracking-wider px-2 py-1 rounded-full font-semibold" style={{ color: "var(--success)", background: "rgba(31, 138, 95, 0.1)" }}>
              <Clock size={10} /> rest {Math.floor(restElapsed/60)}:{String(restElapsed%60).padStart(2,"0")}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {ex.reps.map((r, i) => (
            <SetRow key={i} setNum={i + 1} reps={r} lastReps={ex.lastReps[i]} targetMax={ex.targetReps[1]} onChange={(v) => setReps(i, v)} onRemove={ex.reps.length > 1 ? () => removeSet(i) : null} />
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
            style={{ color: confirmRemove ? "#dc2626" : "var(--navy-400)" }}
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
          style={{ color: confirmRemove ? "#dc2626" : "var(--navy-400)" }}
        >
          <Trash2 size={12} />
          {confirmRemove ? "Tap to confirm removal" : "Remove this exercise"}
        </button>
      )}
    </div>
  );
}

function SetRow({ setNum, reps, lastReps, targetMax, onChange, onRemove }) {
  const hitTarget = reps >= targetMax;
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-xl border transition"
      style={{
        background: reps > 0 ? hitTarget ? "rgba(31, 138, 95, 0.06)" : "var(--surface)" : "var(--surface-2)",
        borderColor: reps > 0 ? hitTarget ? "rgba(31, 138, 95, 0.25)" : "var(--border)" : "var(--border)",
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] uppercase tracking-wider mono shrink-0 font-semibold" style={{ background: "var(--navy-50)", color: "var(--navy-600)" }}>{setNum}</div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(reps - 1)} className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
          <Minus size={14} />
        </button>
        <input type="number" inputMode="numeric" value={reps || ""} onChange={(e) => onChange(parseInt(e.target.value) || 0)} placeholder={lastReps ? String(lastReps) : "0"} className="w-14 h-9 surface border border-soft rounded-lg text-center text-base font-semibold mono focus:outline-none focus:border-strong text-navy-900" />
        <button onClick={() => onChange(reps + 1)} className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95" style={{ background: "var(--navy-100)", color: "var(--navy-700)" }}>
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-end gap-2 text-[10px] mono text-navy-400">
        {lastReps !== undefined && <span>last: {lastReps}</span>}
        {onRemove && (
          <button onClick={onRemove} className="text-navy-300 hover:text-red-600 p-1 transition">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
