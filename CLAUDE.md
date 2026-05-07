# Spotter — Project Context

This file gives you (Claude Code) the design context for Spotter. Mac built this with another Claude instance over a long conversation; this is the condensed handoff. Read it before making changes so you preserve the design decisions and don't undo intentional choices.

## What this is

A personal workout tracker built as a PWA. Mac (Mackenzie Clark) is a Partner Engineer at Torq, an avid lifter, and was previously tracking workouts in a Google Sheet. The app is single-user for now, designed to install to his iPhone home screen and work offline.

## The user

Mac is the user. He's based in Atlantic Canada, lifts at Synergy Health & Sports Performance in Fredericton. Background as a PGA coaching professional turned tech, so he understands product polish. He's not the average gym-app user — he wants something opinionated and good, not feature-bloated. His seed data in the app comes from his actual training log.

## Tech stack

- **Vite + React 18** (single-file app in `src/App.jsx` — yes it's huge, that's intentional for v1)
- **Tailwind CSS** for utilities
- **lucide-react** for icons
- **localStorage** for persistence via `useLocalStorage` hook in `src/hooks/`
- **vite-plugin-pwa** for installability and offline support
- **Vercel** for hosting (auto-deploys on push to `main`)

There's no backend, no auth, no database. All data lives on the device. This is a deliberate v1 choice.

## Design system

**Theme:** light, white + dark navy. Apple-simplicity influence, but with personality.

Color tokens (defined in the inline `<style>` tag inside `App.jsx`):
- `--navy-900` (#0a1f3d) — primary dark, used for text, primary buttons, hero gradients
- `--navy-700`/`--navy-600`/etc. — graduated tints, used for subtle UI
- `--navy-100`/`--navy-50` — pale tints for chip backgrounds, hover states, tile backgrounds
- `--bg` (#fafbfd) — warm off-white app background
- `--surface` (white) — cards
- `--surface-2` (#f6f8fc) — secondary surfaces, input fields in some contexts
- `--border` / `--border-strong` — subtle gray-blue borders
- `--accent` (#c89945) — warm gold, used **only** for "Time to level up" alerts (deliberate scarcity — it should feel earned)
- `--success` (#1f8a5f) — forest green, used for the Finish Workout button and rest timer
- Red (#dc2626) — destructive actions only (delete, remove)

**Fonts:**
- **Inter** for body text and most UI
- **Fraunces** (serif, with optical sizing) for major screen titles and the brand wordmark — gives editorial feel
- **JetBrains Mono** with tabular figures for all numbers (weights, reps, dates, stats) so columns line up

**Tone:**
- Hero screens use dark navy gradient backgrounds with white text — visual punch, focal points
- Most cards are white with very soft shadows (`card-shadow` class)
- Italicized words in serif headlines as a small flourish ("Let's get to *work.*")
- Uppercase tracked-out micro-copy in mono for labels ("ACTIVE SESSION", "BORN", "VOLUME")

## Information architecture

Bottom tab bar with 4 tabs:
1. **Home** — greeting, big Start Workout button, level-up alerts, recent workouts list, library link
2. **Past** — past workouts grouped by month, with stat tiles up top
3. **Plans** — workout templates (e.g. "Push Day A") that pre-populate exercises
4. **Health** — placeholder/stub for v2 (body weight tracking, Apple Health, PRs, volume charts)

Profile is accessible via a circular bubble (initials or photo) in the top-right of the header on every screen except active workouts.

## Data model

Five top-level state collections, all persisted via `useLocalStorage`:

1. **`exercises`** — the canonical library. Each has: `id`, `name`, `targetReps: [min, max]`, `unit`, `muscle`, `equipment`, `bumpRule` ("all" | "majority" | "any"), `increment` (lb/kg per +/- tap)
2. **`history`** — flat array of logged sets. Each entry: `id`, `date` (ISO timestamp), `exercise` (name string, references library), `weight`, `reps` (array of rep counts per set), `targetReps`, `unit`, `note`, `workoutId`
3. **`sessions`** — workout sessions. Each: `id`, `startedAt`, `endedAt`, `name`. History entries reference sessions via `workoutId`.
4. **`plans`** — named workout templates. Each: `id`, `name`, `description`, `exercises` (array of exercise name strings)
5. **`profile`** — single object with: `name`, `email`, `photo` (base64 or null), `dateOfBirth`, `heightCm`, `weightKg`, `gender`, `goal`, `homeGym`, `units` ("imperial" | "metric"), `memberSince`

Plus `activeWorkout` (also persisted, so a mid-session refresh doesn't lose progress).

Two reserved fields exist on exercises and plans for forward-compatibility but have no UI today (beyond the bodyweight toggle in exercise edit): `tracksWeight` (boolean, defaults to true) on exercises, and `visibility` ('private' | 'public' | 'org', defaults to 'private') on both exercises and plans. The app currently treats everything as private and weighted unless explicitly flagged. See "Future / parked decisions" for what these are reserving for.

Internally, height and weight are always stored metric. The `units` field controls display only. When units flip, the imperial inputs in the edit form re-derive from cm/kg cleanly.

## Progression logic (important — don't simplify)

This is the core "smart" feature. When a user finishes an exercise, the app evaluates whether they've earned a weight bump using the rule configured per exercise:

- **"all"** — every set hits the top of the rep range (conservative, default for compounds)
- **"majority"** — more than half the sets hit the top (balanced)
- **"any"** — any single set hits the top (aggressive, default for isolation work)

If the user falls below the rep minimum, status is "hold" (stay at this weight). Otherwise "progress" (working toward the goal).

The bump suggestion uses the exercise's configured `increment` (e.g. 2.5 lb for lateral raises, 5 lb for bench). The `+`/`-` weight buttons during workouts also use this increment.

`getProgressionStatus(entry, libEx)` and `suggestedNextWeight(entry, libEx)` take the library exercise as a second arg to read these settings. Don't break this signature — the alerts on the home screen and the auto-suggested starting weight in active workouts both depend on it.

## Active workout flow (the most-used screen)

Tap **Start Workout** → bottom sheet asks "blank or pick a plan?" → exercise picker (search bar with create-new affordance for unknown exercises) → active exercise screen.

Active exercise screen shows:
- Exercise name in serif
- "Bumped from Xlb" indicator if progression triggered
- Read-only "Last time" reference card
- **Tappable weight number** (tap to edit directly with decimals to 0.1, +/- buttons for nudges by configured increment)
- Sets list with +/- rep buttons and direct number input
- Auto-starting rest timer in the corner when first set is logged
- Add note (optional)
- Remove this exercise (with tap-to-confirm pattern)

Multi-exercise workouts show pill tabs at the top to switch between exercises. Finish Workout button at the bottom prompts for a workout name.

**One-handed gym-floor design principles:**
- Huge tap targets
- Numbers are big and editable
- No keyboards required for common flows (use +/- buttons)
- The weight stays in dark navy gradient cards so it's the visual anchor

## Things that look like UX choices but are deliberate

- **The serif "Spotter" wordmark and screen titles** are intentional — gives the app character. Don't switch to all-Inter.
- **Volume calculation converts each entry to the user's preferred unit before summing** — this is correct, do not simplify. Mixed lb/kg history would break otherwise.
- **The "tap to edit" hint on the weight display disappears on first edit** — small detail, but signals the affordance only when needed.
- **CSV export has a fallback modal** that shows the CSV inline with a copy button if direct download is blocked (sandboxed iframes). Don't remove this fallback.
- **DOB is stored, age is not displayed** — Mac specifically asked for this. The About card shows the long date; no age calculation.
- **Profile bubble hides during active workouts** — don't want to lose focus mid-session.
- **Editing past workouts** is mode-based (toggle Edit / Done) inside the session detail view, not a separate screen.
- **Rep targets are baked into history entries**, not just looked up live — this is correct so changing an exercise's rep range doesn't retroactively re-judge old performance.

## Things explicitly planned for v2 (do not build without asking)

- Apple Health integration (steps, body weight sync) — needs Capacitor or native wrapper, not just PWA
- IndexedDB migration (when localStorage gets cramped)
- Multi-user / profile switching
- Cloud sync between devices
- Volume / PR charts on the Health tab
- Smarter progression suggestions driven by `goal` field

The Health tab is currently a stub with placeholder cards. Don't fill it in piecemeal — it's intentionally a roadmap preview.

## Style of changes Mac likes

- Small, well-scoped commits
- New features should match the existing visual language (navy/white, mono numbers, tracked-out labels) without inventing new patterns
- Confirm destructive actions with the inline tap-to-confirm pattern (single tap → button turns red and reads "Tap to confirm" → second tap commits, auto-cancels after 3s)
- Bottom sheets for modals (with the little drag handle bar)
- New flows should be reachable with minimal taps from Home — Mac uses this in the gym, not at a desk

## Future / parked decisions

These are real product directions Mac is interested in but explicitly deferred. Don't build any of them without an explicit ask, but be aware they exist so you don't accidentally close off the path.

- **Organizations / gym memberships.** Gyms could have accounts and post workouts/plans visible only to their members. Real product work — needs membership lifecycle, permissions, billing, discovery flows. Not v1. Don't add an `organizations` table or any related schema until this is actively being designed.

- **Public and semi-public content.** Three tiers envisioned: public (e.g. fitness influencer publishes plans available to everyone), org-scoped (gym shares with members only), and private (default, single user). The schema reserves a `visibility` field on plans and exercises with values 'private' | 'public' | 'org' to keep the option open, but the app currently treats everything as private. No UI for browsing or publishing yet.

- **Time-based exercise tracking** (e.g. plank held for 90 seconds vs. plank as 90 reps). Currently tracked as reps with seconds-as-the-unit, which works but is semantically loose. A real implementation would add a `tracking_mode` field ('reps' | 'time' | 'distance') on exercises and adapt the active workout UI accordingly. Defer until a user actually complains about it.

- **Apple Health integration** — listed elsewhere; reiterating here that this requires a Capacitor or native iOS wrapper, not just PWA. Don't try to bolt it on inside the PWA.

- **Side imbalance detection (v2 of per-side tracking).** Once users have logged enough per-side reps, surface insights like "your left side averages 15% fewer reps than your right" or "your right side has consistently done 5lb more on lateral raises." This builds on the per-side data model already in place. Could appear as a small section in past session detail ("imbalance noted: -15% on left side this session") or as a profile-level summary over time. Defer until users actually have per-side data accumulated — meaningless without 4-6 weeks of logged sessions.

- **AI-generated workout plans from natural-language goals.** Replace (or supplement) the simple "Goal" text field with the ability for users to describe their goals in plain language ("I want to put on size in my arms," "training for a wedding in 6 months," "rebuilding after knee surgery"). The app would call an LLM server-side to generate a personalized multi-week plan that gets added to their Plans tab as regular plan(s).

  Required infrastructure:
  - Serverless function (Vercel Edge Function or Supabase Edge Function) to call the LLM API — never call from client code, the API key must stay server-side
  - Structured output schema so plans deserialize into the existing plans/exercises data model
  - Rate limiting per user (e.g. one generation per day) to control cost
  - Loading state with streaming output if possible (generations take 5-30 seconds)

  Design questions to settle when building:
  - One-shot static plan, or dynamic plan that adapts based on logged workouts each week?
  - Can the user edit the AI's plan before accepting, or is it locked?
  - What fallbacks if the LLM returns garbage or references exercises not in the user's library?
  - How prominent in the UI? Profile field? Dedicated "AI coach" tab? Onboarding step?

  This is the kind of feature that would meaningfully differentiate Spotter from "yet another lift logger." But it's substantial work (2-3 weeks of focused development) and depends on real usage signal first — wait until Spotter has been used by Mac and a small group of friends for several weeks of actual training before building, so the AI has a decent sense of what good plans look like in practice. Don't build before that.

  Cost expectation: $0.005-$0.05 per generation depending on model and context size. Negligible for personal/friends use, becomes real at scale.

## Known limitations (not blocking)

- **DOB backfill on every sign-in.** The migration that populates DOB from auth metadata into the profiles table runs on every fetch where DOB is null. If a user deliberately clears their DOB and signs back in, it will be re-populated from signup metadata. Probably fine — auth metadata is treated as the source of truth at signup — but worth knowing it isn't strictly a one-shot migration.

- **Race condition on first-ever profile fetch after signup.** Brief window (~milliseconds) between `auth.users` insert and the `handle_new_user` trigger creating the corresponding `profiles` row. If the app fetches the profile in that window, it fails and the user sees a retry button. Retry always succeeds. Not worth fixing at current scale; would require either polling the trigger or having the app create the profile row itself instead of relying on the DB trigger.

- **Portrait orientation can't be enforced in a PWA.** The manifest requests `orientation: portrait` but iOS Safari (and most mobile browsers) ignore that hint for installed PWAs. The fallback is a CSS-only `.rotate-warning` overlay shown via `@media (max-width: 768px) and (orientation: landscape)` that hides `.app-content` and swaps in a "rotate to portrait" message. This is as good as it gets — `screen.orientation.lock()` is unsupported in Safari and unreliable elsewhere. Don't try to enforce orientation programmatically.

## When in doubt

Ask before:
- Adding new top-level navigation (the 4 tabs are intentional)
- Changing the data model (especially renaming/removing fields — historical data lives on the user's device and migrations are painful)
- Restructuring the single-file App.jsx into many files (this is a v1 simplification choice — splitting is fine eventually but should be done thoughtfully)
- Adding dependencies — the dep list is small for a reason
- Changing colors or typography in ways that affect the whole app

Otherwise: ship it.
