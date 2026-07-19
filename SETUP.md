# Setup & Upgrade Notes

## Fresh install (REQUIRED after replacing old version)

```bash
# 1. Delete old vite dependency cache — fixes the mobilenet import error
rm -rf node_modules/.vite

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

If the mobilenet error still appears in your browser, also clear the browser's
hard cache: Chrome → DevTools → Network tab → right-click Reload → "Empty Cache and Hard Reload"

## What was fixed

| Problem | Root cause | Fix |
|---|---|---|
| `mobilenet.js` export error | Old vite cache from a previous build referencing a deleted import | `force: true` in vite.config + exclude `@tensorflow-models/mobilenet` |
| "Not matched" at 60% for identical signature | DTW enrollment threshold min was 0.04 (too tight for touch), pass threshold was 55 | Threshold min raised to 0.12, scale factor raised to 4.5×, pass threshold lowered to 45 |
| App opens to "Study Statistics" picker | Default screen was `user_select` | App now auto-creates a device user and opens straight to signature canvas |
| Must draw signature 7 times to enroll | `ENROLL_N = 7` | Reduced to `ENROLL_N = 3` |

## How the 2-model pipeline works

Draw → **Model 1: Xenova/mobilevit-small** (image embedding comparison via cosine similarity)
     + **Model 2: Behavioral BiLSTM** (stroke timing, speed, rhythm, pressure comparison via DTW)
     → Fused score → ✅ Match / ❌ No match

Model 1 carries 10% weight and Model 2 (DTW on behavioral features) carries 80–90%
depending on whether the image model loaded successfully.

## Deployment (must be HTTPS)

```bash
npm run build   # outputs to /dist
```
Host the /dist folder on Vercel, Netlify, or GitHub Pages — all serve HTTPS automatically.
**Do NOT open via http://your-local-ip — that breaks the encryption API on mobile.**
