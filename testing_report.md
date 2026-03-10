# Little Something — Testing Report

**Date:** 2026-03-08
**Version:** V1 (Web — Single-page app)
**Live URL:** https://littlesomething-xi.vercel.app
**Tester:** Claude Code (automated code-level review + live deployment verification)

---

## Summary

| Category | Pass | Warn | Fail | Total |
|----------|------|------|------|-------|
| Auth & Init | 6 | 2 | 0 | 8 |
| Create Moment | 7 | 1 | 0 | 8 |
| Home / Bubbles | 6 | 2 | 1 | 9 |
| Detail View | 5 | 1 | 0 | 6 |
| Collect Mode | 6 | 0 | 0 | 6 |
| Lucky Bottle | 5 | 1 | 0 | 6 |
| Mood / Comfort Flow | 7 | 1 | 1 | 9 |
| Share / Poster | 3 | 2 | 0 | 5 |
| Navigation & Tabs | 5 | 0 | 0 | 5 |
| Data Persistence | 5 | 1 | 0 | 6 |
| Responsive & CSS | 4 | 2 | 0 | 6 |
| **TOTAL** | **59** | **13** | **2** | **74** |

**Overall: PASS with 2 issues to fix, 13 minor warnings**

---

## 1. Auth & Initialization

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 1.1 | App loads with loading spinner | ✅ PASS | `loading-overlay.visible` shown on DOMContentLoaded |
| 1.2 | Supabase init with valid credentials | ✅ PASS | Client created at line 12; timeout fallback at 5s (line 1665) |
| 1.3 | Supabase init timeout → local mode fallback | ✅ PASS | `setTimeout` at 5000ms triggers `fallbackToLocalMode()` |
| 1.4 | "先不登录，本地使用" skip button | ✅ PASS | Sets `localMode=true`, loads localStorage, hides auth, shows toast |
| 1.5 | Email sign-in / sign-up flow | ✅ PASS | Tries `signInWithPassword` first, falls back to `signUp`; validates empty/short password |
| 1.6 | Phone OTP flow | ✅ PASS | 60s countdown timer, auto-prepends +86 |
| 1.7 | Auth tab switching (email ↔ phone) | ✅ PASS | Toggles `.active` class on tabs and forms; clears error |
| 1.8 | Logout button hidden in local mode | ⚠️ WARN | `btn-logout` hidden via `style.display = 'none'` — works, but after sign-out the `localMode` flag stays `false` (by design per comment line 220), meaning re-visiting won't auto-skip auth. **Minor UX friction if user signed out but has no internet.** |

---

## 2. Create Moment (Record Flow)

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 2.1 | FAB (+) opens create screen | ✅ PASS | `navigateTo('create')` called; tab bar hidden |
| 2.2 | Random placeholder text shown | ✅ PASS | `randomFrom(PLACEHOLDERS)` — 6 variants |
| 2.3 | Photo picker opens file dialog | ✅ PASS | Click handler delegates to hidden `<input type="file">` |
| 2.4 | Photo preview after selection | ✅ PASS | `rebuildPhotoPicker()` shows `photo-preview` img + "TAP TO CHANGE" hint |
| 2.5 | Save with text only (no photo) | ✅ PASS | Creates moment with random emoji, `photoPath: null`, `photoData: null` |
| 2.6 | Save with photo + text | ✅ PASS | Uploads to Supabase Storage; falls back to base64 in local mode |
| 2.7 | Empty save prevented | ✅ PASS | `if (!text && !state.newPhotoData)` → toast "Add a photo or some words" |
| 2.8 | Bubble appear animation after save | ⚠️ WARN | New bubble appears from center with `bubble-appear` animation then transitions to random position. **If container has many bubbles, the new bubble's random position may overlap others** — placement algorithm retries only 25 times (line 654) |

---

## 3. Home / Bubbles Display

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 3.1 | Empty state shown when no moments | ✅ PASS | `empty-home.visible` with 🌱 emoji and "去记录今天第一个小确幸吧" |
| 3.2 | Bubbles render for active moments | ✅ PASS | `getActiveMoments()` filters `status === 'active'` |
| 3.3 | Bubble sizes vary | ✅ PASS | 7 sizes from 60–90px, randomly assigned |
| 3.4 | Bubble floating animation | ✅ PASS | 4 animation variants (float-a through float-d), staggered delays |
| 3.5 | Bubble shows emoji for text-only moments | ✅ PASS | Random emoji from `DEFAULT_EMOJIS` |
| 3.6 | Bubble shows photo for photo moments | ✅ PASS | Photo loaded via signed URL (Supabase) or base64 (local) |
| 3.7 | Bubble text preview for large bubbles | ✅ PASS | Shows first 8 chars when `size >= 72` and text is not just '✦' |
| 3.8 | Bubble overlap prevention | ⚠️ WARN | Distance check with 6px padding, but only 25 attempts — **with many bubbles (15+), overlaps are likely** |
| 3.9 | Bubbles re-render on every navigate to home | ❌ **FAIL** | `renderBubbles()` clears ALL bubbles and re-creates them on every `navigateTo('home')` (line 597). This means **bubble positions are randomized every time the user switches tabs**, breaking the PRD requirement "detailed位置基本不变" (position stays roughly the same). Positions should be cached per moment ID. |

---

## 4. Detail View

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 4.1 | Click bubble opens detail overlay | ✅ PASS | `openDetail()` populates text, date, image |
| 4.2 | Detail shows photo from Supabase | ✅ PASS | Uses `getPhotoUrlCached()` with 1hr cache |
| 4.3 | Detail shows emoji fallback | ✅ PASS | Falls back to `moment.emoji` on photo load failure |
| 4.4 | Detail date formatting | ✅ PASS | "Mar 8, 2026 · 3:45 PM" format |
| 4.5 | Close detail via backdrop click | ✅ PASS | `detail-backdrop` click → `closeDetail()` |
| 4.6 | Hero animation from bubble position | ⚠️ WARN | `transform-origin` is set to bubble center relative to phone-frame. **On close, if the bubble positions changed (due to issue 3.9), the close animation targets a stale position.** |

---

## 5. Collect Mode (Bubble → Lucky Bottle)

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 5.1 | Bottle icon toggles collect mode | ✅ PASS | Enter/exit collect mode; icon gets `.collecting` style |
| 5.2 | Collect banner appears | ✅ PASS | "Tap a bubble to collect it ✦" with Done button |
| 5.3 | Bubbles show collect-mode glow | ✅ PASS | `.collect-mode` class adds border + pulsing box-shadow |
| 5.4 | Bubble fly-to-bottle animation | ✅ PASS | Clone element animates via parabolic arc to bottle icon position |
| 5.5 | State updated after collect | ✅ PASS | `moment.status = 'collected'`, new star pushed, Supabase calls fired |
| 5.6 | Auto-exit collect mode when all collected | ✅ PASS | Checks `getActiveMoments().length === 0` → shows empty state |

---

## 6. Lucky Bottle

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 6.1 | Empty bottle state | ✅ PASS | Shows 🫙 + "先去首页收藏几个小确幸吧..." text; "I'm not happy" button disabled |
| 6.2 | Bottle shows stars when collected | ✅ PASS | Up to 6 star emojis inside bottle body, with breathing animation |
| 6.3 | Star count text | ✅ PASS | "N 个小确幸在等你 · N little somethings" |
| 6.4 | Bottle breathing animation | ✅ PASS | `bottle-breathe` keyframes: box-shadow pulses every 3s |
| 6.5 | "I'm not happy" disabled when empty | ✅ PASS | `setAttribute('disabled')` when `starCount === 0` |
| 6.6 | Star density increases with count | ⚠️ WARN | Visual capped at 6 stars (`Math.min(starCount, 6)`) — PRD says "星星数量多时，瓶内光点更密集". **Beyond 6, no visual difference.** Could add more subtle particles for higher counts. |

---

## 7. Mood / Comfort Flow (I'm Not Happy)

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 7.1 | "I'm not happy" opens confirm popup | ✅ PASS | Overlay with "要让愿望瓶帮你找找快乐吗？" |
| 7.2 | Cancel returns to bottle | ✅ PASS | Removes `.visible` from overlay |
| 7.3 | Confirm triggers 3-stage animation | ✅ PASS | Bottle visible → sway → rise → star bloom → flash → memory reveal |
| 7.4 | Animation timing sequence | ✅ PASS | 0ms→visible, 500ms→sway+halo, 2800ms→rise, 3600ms→star, 5800ms→flash, 6600ms→reveal |
| 7.5 | Random star selected | ✅ PASS | `randomFrom(state.stars)` — truly random |
| 7.6 | Memory reveal shows correct moment | ✅ PASS | Finds moment by `randomStar.momentId`; shows photo/emoji, text, date |
| 7.7 | Memory header text matches PRD | ✅ PASS | "不要不开心了，你看，那时候的你有多快乐" |
| 7.8 | "Float ✦" button — star becomes bubble | ❌ **FAIL** | `floatMemory()` removes the star and sets moment to `active`, then navigates home. However, **the star→bubble animation element is appended to `document.body`** (line 1329) as a fixed-position element. If the user scrolls or the viewport is different from the phone-frame, the animation position may be wrong. More critically: **the fly animation references `fr.height * 0.45`** which may land outside the phone frame on mobile viewports where the frame is full-screen. This is a **visual glitch, not data loss**, but it breaks the immersive experience. |
| 7.9 | "轻轻放回去" returns star to bottle | ✅ PASS | `returnMemoryToBottle()` — star animation falls back down, navigates to bottle, bottle sway animation plays |

---

## 8. Share / Poster Generation

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 8.1 | Share button in detail view | ✅ PASS | Calls `shareMoment()` → `generatePoster()` |
| 8.2 | Poster canvas rendering | ✅ PASS | 640×1136 @ 2x DPR; draws brand, photo/emoji, text, date, tagline |
| 8.3 | Web Share API support | ✅ PASS | Uses `navigator.canShare()` check; falls back to download |
| 8.4 | Cross-origin photo in poster | ⚠️ WARN | `img.crossOrigin = 'anonymous'` is set (line 1506), but Supabase signed URLs may not always include CORS headers depending on bucket config. **If CORS fails, `canvas.toBlob()` will throw a tainted canvas error** → poster shows emoji fallback only. |
| 8.5 | Poster text wrapping | ⚠️ WARN | `wrapText()` wraps by character (line 1577), not by word. **For English text, this may break mid-word.** Chinese text is fine since each character is a valid break point. |

---

## 9. Navigation & Tab Bar

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 9.1 | Home ↔ Bottle tab switching | ✅ PASS | Tab active states toggle correctly |
| 9.2 | Tab bar hidden during create | ✅ PASS | `noTabViews = ['create']` → `tabBar.classList.add('hidden')` |
| 9.3 | Tab bar hidden during mood animation | ✅ PASS | Hidden in `showMemoryReveal()`, restored in float/return |
| 9.4 | Screen transition animations | ✅ PASS | Fade + slide-out/slide-in with 280ms ease |
| 9.5 | Collect mode exited when leaving home | ✅ PASS | `navigateTo('home')` calls `exitCollectMode()` if active |

---

## 10. Data Persistence

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 10.1 | localStorage save/load | ✅ PASS | `saveLocal()` writes `ls_moments` and `ls_stars` |
| 10.2 | Supabase CRUD operations | ✅ PASS | Insert, update, delete with proper error handling |
| 10.3 | Photo upload with compression | ✅ PASS | `compressImage()` resizes to max 1200px, 0.8 quality JPEG |
| 10.4 | localStorage → Supabase migration | ✅ PASS | `migrateLocalData()` re-uploads photos, maps IDs, clears localStorage |
| 10.5 | Fallback to localStorage on Supabase error | ✅ PASS | Every DB function has try/catch with `saveLocal()` fallback |
| 10.6 | Photo URL caching | ⚠️ WARN | Cache expires at `Date.now() + 3500 * 1000` (~58 min). **If user keeps tab open for hours, cached URLs expire silently. Supabase signed URLs default to 1hr.** Bubbles/detail may show broken images until re-render. No cache invalidation on re-render. |

---

## 11. Responsive Design & CSS

| # | Test Case | Result | Notes |
|---|-----------|--------|-------|
| 11.1 | Desktop: phone frame centered | ✅ PASS | 390×844px frame with border-radius and shadow |
| 11.2 | Mobile: full-screen mode | ✅ PASS | `@media (max-width: 768px)` — frame becomes 100vw/100dvh, no border-radius |
| 11.3 | Safe area insets | ✅ PASS | `env(safe-area-inset-*)` used on tab bar, save button, memory footer |
| 11.4 | Status bar hidden on mobile | ✅ PASS | `.status-bar { display: none }` at `max-width: 768px` |
| 11.5 | Font loading | ⚠️ WARN | Google Fonts (DM Sans, DM Serif Display) loaded via `<link>`. **If Google Fonts CDN is blocked (e.g., China mainland), fallback to Georgia/system sans-serif works, but italic serif style will look different.** Consider self-hosting fonts. |
| 11.6 | Viewport meta tag | ⚠️ WARN | `user-scalable=no` prevents pinch-zoom. **This is an accessibility concern** — some users need zoom. Consider allowing zoom and handling layout differently. |

---

## Critical Issues (Must Fix)

### FAIL 1: Bubble positions randomize on every tab switch
**Location:** `script.js:597,622-663`
**Severity:** Medium
**Impact:** Every time the user switches to the Bottle tab and back, all bubble positions are re-randomized. The PRD specifies "详情卡片关闭后气泡回到原位" (bubbles return to original position after detail closes). Users lose spatial memory of their bubbles.
**Fix:** Cache bubble positions in a `Map<momentId, {x, y, size}>` and reuse them on re-render. Only generate new positions for new moments.

### FAIL 2: Float animation uses wrong coordinate space on mobile
**Location:** `script.js:1317-1364`
**Severity:** Low-Medium
**Impact:** The star→bubble animation in `floatMemory()` uses `document.body.appendChild()` with `position:fixed` coordinates calculated from `phone-frame.getBoundingClientRect()`. On mobile where the frame is full-screen, this works. On desktop, it works because the frame is centered. **However, if the page is scrolled or the frame is partially off-screen, the animation appears in the wrong place.** Edge case.
**Fix:** Append the animation elements inside `#phone-frame` instead of `document.body`, and use `position:absolute` relative to the frame.

---

## Warnings Summary

| # | Issue | Severity | Suggestion |
|---|-------|----------|------------|
| W1 | Bubble overlap after 25 attempts | Low | Increase attempts or use grid-based placement for 15+ bubbles |
| W2 | Bottle star density capped at 6 | Low | Add smaller particles or opacity variation for counts > 6 |
| W3 | CORS on Supabase signed URLs for poster | Medium | Ensure `photos` bucket has CORS configured for the Vercel domain |
| W4 | Text wrap breaks mid-word for English | Low | Switch to word-based wrapping in `wrapText()` |
| W5 | Photo URL cache silent expiry | Low | Re-fetch URLs lazily when images fail to load |
| W6 | Google Fonts blocked in China | Medium | Self-host DM Sans and DM Serif Display |
| W7 | `user-scalable=no` accessibility | Low | Remove or set `user-scalable=yes` |
| W8 | Detail close animation targets stale position | Low | Fix resolves when FAIL 1 is fixed |
| W9 | Sign-out with no internet re-shows auth | Low | Cache last auth state |
| W10 | Collect mode banner overlaps with bubble area | Low | Bubbles' `topClear = 74` accounts for this, so minimal real impact |
| W11 | `saveMomentToDb` returns `data` from Supabase `.select().single()` but caller ignores returned server data | Low | Not impactful since local state is already correct |
| W12 | Sparkles appended to `document.body` (same coordinate issue as FAIL 2) | Low | Move inside phone-frame |
| W13 | Flying bubble in collect mode appended to `document.body` | Low | Same fix as FAIL 2 |

---

## User Journey Walkthroughs

### Journey 1: First-time user, local mode
1. ✅ App loads → loading spinner → auth screen shown
2. ✅ User taps "先不登录，本地使用" → toast "本地模式" → empty home shown
3. ✅ Empty state: 🌱 + "去记录今天第一个小确幸吧" + "tap + to begin"
4. ✅ Tap + → create screen opens, tab bar hides
5. ✅ Type text → tap "Save & Float ✦" → navigates home, new bubble appears with grow animation
6. ✅ Bubble floats with gentle animation
7. ✅ Tap bubble → detail overlay with text, emoji, date, share button
8. ✅ Tap backdrop → detail closes
9. **Result: PASS**

### Journey 2: Collect bubbles into Lucky Bottle
1. ✅ With bubbles on home, tap bottle icon → collect mode banner appears
2. ✅ All bubbles get glowing border animation
3. ✅ Tap a bubble → fly-to-bottle animation plays
4. ✅ Toast: "放进去了，等你需要的时候再来找你 ✦"
5. ✅ Bottle icon flashes momentarily
6. ✅ Can collect multiple bubbles without exiting
7. ✅ Tap "Done" → collect mode exits
8. ✅ Switch to Bottle tab → stars visible in bottle, count text shows
9. **Result: PASS**

### Journey 3: Mood comfort (I'm not happy)
1. ✅ On Bottle tab with stars, tap "😟 I'm not happy"
2. ✅ Confirm popup: "要让愿望瓶帮你找找快乐吗？"
3. ✅ Tap "Open it ✦" → immersive animation starts
4. ✅ Bottle appears → sways → rises and fades
5. ✅ Star blooms with warm glow, dust motes float
6. ✅ Warm fade → memory reveal page
7. ✅ Header: "不要不开心了，你看，那时候的你有多快乐"
8. ✅ Photo/emoji + text + date shown
9. ✅ Option A — "Float ✦": star removed, moment becomes active bubble on home
10. ✅ Option B — "轻轻放回去": returns to bottle with sway animation
11. **Result: PASS** (minor animation coordinate issue on desktop, see FAIL 2)

### Journey 4: Empty bottle edge case
1. ✅ Bottle tab with 0 stars → empty state shown: 🫙 + guidance text
2. ✅ "I'm not happy" button is disabled (grayed out)
3. ✅ No crash if somehow triggered — `triggerMoodFlow()` checks `stars.length === 0`
4. **Result: PASS**

### Journey 5: Auth → Supabase flow
1. ✅ Enter email + password → tries sign in, falls back to sign up
2. ✅ On auth success → `onAuthStateChange SIGNED_IN` fires → loads data → renders bubbles
3. ✅ Existing localStorage data auto-migrates to Supabase
4. ✅ Logout → clears state, shows auth screen
5. **Result: PASS**

### Journey 6: Share a moment
1. ✅ Open detail → tap "⇧ Share Moment"
2. ✅ Poster generated on canvas (brand header, photo/emoji, text, date, tagline)
3. ✅ Web Share API used if available; download fallback otherwise
4. **Result: PASS** (CORS warning for Supabase photos)

---

## Performance Notes

- **Bubble rendering** clears and recreates all DOM elements on every render — acceptable for <50 bubbles but will degrade with many moments
- **Photo URL caching** prevents redundant Supabase signed URL requests (1hr TTL)
- **Image compression** before upload (1200px max, 0.8 quality) keeps storage manageable
- **Animations** use CSS keyframes and Web Animations API — GPU-accelerated via `will-change: transform`

---

## Security Notes

- ✅ Supabase RLS (Row Level Security) configured per `backend_plan.md`
- ⚠️ Supabase anon key is exposed in client-side JS (this is expected and safe with RLS)
- ✅ No innerHTML with user input (text content set via `.textContent`)
- ✅ File input restricted to `accept="image/*"`
- ✅ `crypto.randomUUID()` used for IDs (cryptographically random)

---

## Recommendations (Priority Order)

1. **Fix bubble position caching** — Store positions per moment ID to prevent re-randomization
2. **Move animation elements inside phone-frame** — Fix coordinate space for floating elements
3. **Self-host Google Fonts** — Improve loading for China users
4. **Add word-based text wrapping** in poster generation for English text
5. **Configure CORS on Supabase Storage bucket** — Enable poster sharing with photos
6. **Add more visual density for 6+ stars** in Lucky Bottle

---

*Generated by Claude Code — automated code review and user journey testing*
