# Spotter

Personal workout tracker. Built as a PWA (Progressive Web App) so it installs to your phone home screen and works offline.

## What you're getting

A complete Vite + React project with:

- The full Spotter UI (your existing tracker)
- localStorage persistence — your data survives refresh, app close, phone restart
- PWA setup — installs to iPhone home screen, runs full-screen, works offline
- Tailwind CSS configured
- Navy + white theme already wired up

## Step 1 — Install Node.js

You need Node 18 or newer. Check what you have:

```bash
node --version
```

If it says v18.x or higher, you're good. If not, install it from [nodejs.org](https://nodejs.org/) (download the LTS version) or use Homebrew on Mac:

```bash
brew install node
```

## Step 2 — Install dependencies

From inside this folder:

```bash
npm install
```

This pulls down React, Vite, Tailwind, lucide-react (the icons), the Supabase client, and the PWA plugin. Takes a minute the first time.

## Environment setup

The app needs Supabase credentials to talk to the backend. Copy the example file and fill in your project values:

```bash
cp .env.example .env
```

Then open `.env` and set:

- `VITE_SUPABASE_URL` — your project URL (looks like `https://abcdefg.supabase.co`), found in Supabase project settings → API.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — your project's publishable (anon) key, also from project settings → API.

`.env` is gitignored — never commit it. `.env.example` is the template that lives in the repo.

**Restart `npm run dev` after editing `.env`.** Vite reads env vars at server start, so changes don't pick up live.

## Step 3 — Run it locally

```bash
npm run dev
```

You'll see something like:

```
  VITE v5.3.1  ready in 432 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
```

Open the **Network** URL on your phone (you and your phone need to be on the same Wi-Fi). The app will load. You can use it just like the artifact preview.

Open the **Local** URL in your computer browser to develop.

## Step 4 — Verify persistence works

1. Open the app, log a fake workout
2. Refresh the page
3. Your workout should still be there

If it's not, check the browser console for errors.

## Step 5 — Push to GitHub

You need a GitHub account ([github.com](https://github.com)) and Git installed.

Create a new empty repo on GitHub (don't check "Initialize with README" — we already have files):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/spotter.git
git push -u origin main
```

## Step 6 — Deploy to Vercel

Easiest deploy in the world. Free tier handles this no problem.

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New → Project**
3. Pick your `spotter` repo
4. Vercel auto-detects Vite. Just click **Deploy**
5. Wait ~30 seconds. You get a URL like `spotter-abc123.vercel.app`

That URL is now live on the internet, with HTTPS, free.

## Step 7 — Install on your iPhone

1. Open Safari on your phone
2. Go to your Vercel URL
3. Tap the **Share** button (square with arrow up)
4. Scroll down → tap **Add to Home Screen**
5. Confirm the name → tap **Add**

You now have a Spotter icon on your home screen. Tap it. It opens full-screen, no browser chrome, looks and feels like a native app.

## Step 8 — Use it at the gym

Done. Go lift. Your data persists locally on the phone.

---

## Updating the app later

When you (or I) make changes:

```bash
git add .
git commit -m "What I changed"
git push
```

Vercel auto-detects the push and redeploys in about 30 seconds. Refresh the app on your phone and you're on the new version.

## Customizing the icon

The placeholder icon is a navy dumbbell — clean but generic. To replace:

1. Make a 1024x1024 PNG of your icon
2. Use a tool like [realfavicongenerator.net](https://realfavicongenerator.net/) to generate all the sizes
3. Drop them into `/public`, replacing:
   - `apple-touch-icon.png` (180x180)
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
   - `favicon.svg`

## Troubleshooting

**"npm: command not found"** → Node isn't installed. See Step 1.

**Port 5173 already in use** → Something else is running. Either stop it or run `npm run dev -- --port 3000`.

**App won't install on iPhone** → Make sure you're using Safari (not Chrome). Make sure the URL is HTTPS. Sites served over `http://` can't be installed on iOS.

**Data disappeared on phone** → Safari occasionally clears localStorage if storage is full or the app hasn't been opened in a while. For real durability long-term, the next upgrade is moving to IndexedDB or syncing to a backend.

**Need to wipe all data and start fresh** → In Safari, Settings → Safari → Advanced → Website Data → search "spotter" → swipe to delete. Or in dev tools on your computer: Application → Storage → Clear site data.

## What's next (v2 ideas)

- IndexedDB for more durable storage
- Apple Health integration (requires real native iOS app or Capacitor wrapper)
- Multi-user with profile switching
- Charts on the Health tab
- Cloud sync between devices

---

Built with React, Vite, Tailwind, and Lucide icons. Hosted on Vercel.
