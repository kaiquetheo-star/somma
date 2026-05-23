# SOMMA — Context Anchor V5

**Paste or `@CONTEXT_ANCHOR_V5.md` at the start of every new session.** This file supersedes V4 on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — The Longevity OS |
| **North star** | SHRED-level performance for ~6×/week athletes |
| **Checkpoint** | May 2026 — post sync loop + Ascension Summary; **microcycle generation broken** |
| **Prior anchors** | V1–V4 — historical only |

---

## 1. Current architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Client** | **Expo SDK 54** · RN 0.81 · React 19 · **Expo Router** v6 | `(auth)` · `(tabs)` · `(workout)` |
| **Styling** | **NativeWind v4** + Tailwind 3 | Obsidian `#0F1512` / `#0A0E0C` · Matte Gold `#BFA06A` |
| **State** | **Zustand** + `AsyncStorage` (`somma-offline-store`) | Offline-first gameplan, logs, queue |
| **Sync** | `lib/supabase/sync.ts` | Per-set + block-complete inserts → `performance_logs`; optional Head Coach recalibrate |
| **Backend** | **Supabase** | Postgres · Auth · RLS · Storage (`movement_visuals`) |
| **AI** | Edge Functions **`generate_weekly_microcycle`** (canonical entry) · **`generate_daily_protocol`** (shared handler) | OpenRouter LLM + deterministic pre/post engines |

### Zustand contract (key fields)

| Field | Purpose |
|-------|---------|
| `weeklyMicrocycle` | 7-day `MicrocycleDay[]` (Mon–Sun) |
| `selectedDayIndex` | Active strip day (1–7) |
| `performance_logs` / `performanceQueue` | Local history + pending Supabase sync |
| `lastWorkoutSummary` | Post-workout Ascension metrics |
| `logIronSet` | Each set → local log + background `performance_logs` insert |
| `completeWorkout` | Block finish → queue + recalibrate microcycle |

### Head Coach data path

```
fetchDailyGameplan → generate_weekly_microcycle (fallback: generate_daily_protocol)
  → daily_protocols.microcycle (jsonb) → parseGameplan → Home strip
```

### Repo map (operational)

```
app/(tabs)/home.tsx              # 7-day strip + selected day blocks
app/(workout)/{iron,combat,spirit,ascension,summary}.tsx
components/ui/ModularMovementPlayer.tsx
components/sanctuary/WeeklyMicrocycleStrip.tsx
lib/physics/rmCalculator.ts      # Epley E1RM + getTargetWeight
lib/supabase/sync.ts               # performance_logs sync engine
lib/workout/buildSessionSummary.ts
store/useSommaStore.ts
supabase/functions/generate_weekly_microcycle/index.ts  → delegates to generate_daily_protocol
supabase/functions/generate_daily_protocol/index.ts     # handleHeadCoachRequest (shared)
```

---

## 2. Recent shipped features

| Feature | Location | Notes |
|---------|----------|--------|
| **ModularMovementPlayer** | `components/ui/ModularMovementPlayer.tsx` | `expo-video` (MP4/WebM) + `expo-image` (GIF/WebP); Obsidian gradient fade; typography fallback. Integrated in Iron / Combat / Spirit. Lottie removed. |
| **E1RM target weight engine** | `lib/physics/rmCalculator.ts` | Epley `1RM = weight × (1 + reps/30)`; `getTargetWeight()` from 3-week `performance_logs`; Hypertrophy 70–80% / Strength 85%+. Wired in Edge `prescribeIronExercise` + Iron **Target Load** banner. |
| **7-day Weekly Microcycle Strip** | `WeeklyMicrocycleStrip` + `home.tsx` | Glass strip Mon–Sun; `selectedDayIndex`; rest-day recovery card; **gold checkmark** when `is_completed`. |
| **Post-workout Ascension Summary** | `app/(workout)/summary.tsx` | Last block of day → volume, CNS fatigue, E1RM PRs; sync + recalibrate; Return to Sanctuary. Intermediate blocks → 3s `ascension.tsx`. |
| **Per-set sync loop** | `logIronSet` + `sync.ts` | Each Iron set queued as `iron_set` row; block completion triggers full recalibrate. |

---

## 3. Critical active bug

**Symptom:** `generate_weekly_microcycle` (or client stub/fallback) returns a **full week of Rest & Recovery** — all 7 days `is_rest_day: true`, empty `blocks[]` — **ignoring `profiles.training_days_per_week`**.

**Likely surfaces:**
- Edge handler falls through to rest-week / error payload without surfacing failure to client
- LLM response fails parse/sanitize → deterministic fallback mis-configured
- `fetchDailyGameplan` accepts bad cache from `daily_protocols` without validation
- `generateStubGameplan` only used when offline — verify not masking Edge errors as “success”

**User-visible:** Home strip shows 7 rest bubbles; no Iron/Combat/Spirit blocks; `gameplan_source` may still read `ai` or `stub` with no error UI.

**Silent failure:** Client logs warn only; no blocking error on Home; Recalibrate may re-persist the same empty week.

---

## 4. Next task (new session)

### A. Audit & fix microcycle generation
1. Trace end-to-end: `fetchDailyGameplan` → Edge invoke → LLM → `sanitizeMicrocycle` / `buildDeterministicMicrocycle` → DB upsert → `parseGameplan`.
2. Confirm `training_days_per_week` read from `profiles` and injected into prompt + deterministic builder.
3. Reject/cache-bust protocols where all 7 days are rest or `microcycle.length !== 7` with training blocks.
4. Fix root cause (catalog empty, sanitize dropping days, prompt/schema mismatch, missing `OPENROUTER_API_KEY`, etc.).

### B. Robust Edge logging
- Structured logs at: catalog load, profile read, LLM request/response status, sanitize rejection reasons, final `source` (`ai` | `deterministic` | `fallback`).
- Return explicit `{ error, message, catalog_counts }` to client when generation fails — never silent rest-week as success.

### C. Codebase cleanup
- Remove dead files (deleted Lottie helpers if any remain), orphaned routes, duplicate workout paths (`app\(workout)` vs `app/(workout)` on Windows).
- Align docs: V4 references to `MovementVisualizer` / `generate_daily_protocol`-only deploy → update to V5 reality.
- Run `npx tsc --noEmit` before handoff.

---

## 5. Fresh-session checklist

1. Read **§3 Critical bug** first — do not ship UI polish until microcycle generates training days.
2. Confirm Supabase migrations **001–015+** applied; Edge deployed: `supabase functions deploy generate_weekly_microcycle` (+ legacy alias if needed).
3. Verify `OPENROUTER_API_KEY` set; `library_exercises` / `library_combat` seeded for user equipment.
4. Home stays **strip-first**; do not revert to single-day-only gameplan.
5. Iron uses **E1RM target load**; movement media uses **ModularMovementPlayer** only (no Lottie).

---

*End of Context Anchor V5.*
