# SOMMA — Context Anchor V8

**Paste or `@CONTEXT_ANCHOR_V8.md` at the start of every new session.** This file supersedes V7 on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — The Longevity OS |
| **North star** | SHRED-level performance for ~6×/week athletes |
| **Checkpoint** | May 2026 — Text-Only Elite · **local $0 Head Coach** · **RIR gate + load telemetry** · **Vercel web SPA** · email-only auth · migrations **001–021** |
| **Prior anchors** | V1–V7 — historical only |
| **Last commit** | *(uncommitted session work — verify with `git log -1`)* |
| **Deploy gate** | **`021` migration** must be applied; Edge LLM is **opt-in** only |

---

## 1. Architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Client** | **Expo SDK 54** · RN 0.81 · React 19 · **Expo Router** v6 | `(auth)` · `(tabs)` · `(workout)` |
| **Styling** | **NativeWind v4** + Tailwind 3 | Obsidian `#0F1512` / `#0A0E0C` · Matte Gold `#BFA06A` |
| **State** | **Zustand** + `AsyncStorage` (`somma-offline-store`) | Offline-first gameplan, logs, performance queue |
| **Head Coach** | **`lib/gameplan/engine/*`** | **Deterministic microcycle — $0 API** (catalog + passport + logs) |
| **Sync** | `lib/supabase/sync.ts` | Per-set + block-complete → `performance_logs`; finish → **local** recalibrate |
| **Backend** | **Supabase** | Postgres · Auth (magic link only in UI) · RLS · catalog tables · `daily_protocols` cache |
| **Load telemetry** | `lib/physics/loadTelemetry.ts` | On-device ACWR · sRPE · RPE σ — feeds Head Coach autoreg ($0 API) |
| **Edge (legacy / optional)** | `generate_weekly_microcycle` → `generate_daily_protocol` | Deterministic by default; LLM only if `HEAD_COACH_USE_LLM=true` |
| **Deploy (Vercel)** | `npm run build` → `dist/` SPA | **Web-only** — no iOS/Android bundle in CI |

### Vercel / web export (strict)

| File | Contract |
|------|----------|
| `package.json` | `"build": "npx expo export --platform web"` · `"web": "expo start --web"` |
| `app.json` | `"platforms": ["web"]` only · `"web": { "bundler": "metro", "output": "single" }` · plugins: **`expo-router` only** (no `expo-secure-store` / `expo-audio` config plugins) |
| `vercel.json` | `buildCommand` + `outputDirectory: dist` + SPA rewrite → `index.html` |
| `metro.config.js` | `resolver.platforms = ['web', 'ios', 'android']` — `.web.ts` shims win on export |

**Native shims (do not import native-only modules from shared paths):**

| Module | Web | Native |
|--------|-----|--------|
| `lib/haptics.*` | no-op | `expo-haptics` |
| `lib/audio/combatAudio.*` | no-op | `expo-audio` |
| `lib/supabase/authStorage.*` | `localStorage` | `expo-secure-store` |

iOS/Android blocks removed from `app.json` until native ship returns. Hermes/bin errors on Vercel = usually missing `--platform web` or native config plugins in export.

### Zustand contract (key fields)

| Field | Purpose |
|-------|---------|
| `weeklyMicrocycle` | 7-day `MicrocycleDay[]` (Mon–Sun) |
| `selectedDayIndex` | Active strip day (1–7) |
| `performance_logs` / `performanceQueue` | Local history + pending Supabase sync |
| `user_biological` | Passport + **granular frequencies** + pillar time budgets |
| `gameplan_source` | `'local'` \| `'deterministic'` \| `'ai'` \| `'stub'` \| `'fallback'` |
| `gameplan_error` | Surfaces generation failures (no silent stub when Supabase configured) |
| `fetchDailyGameplanAsync` | Sole owner of `weeklyMicrocycle` after foundation |
| `hydrateFoundationFromRemote` | Profile/stats/equipment only — **no gameplan mutation** |

### Head Coach data path (V8 — client-first)

```
fetchDailyGameplanAsync
  → fetchDailyGameplan (lib/gameplan/fetchDailyGameplan.ts)
      → cache hit? daily_protocols (today)
      → else generateDeterministicGameplan (lib/gameplan/engine/)
          → fetchLibraryExercises / Combat / FlowSpirit (cached v3)
          → user_biological (frequency_iron/combat/spirit, time budgets, goals)
          → performance_logs (Zustand → engine rows)
          → user_stats (combat_mastery, spirit_essence)
      → upsert daily_protocols (source: 'local')
  → parseGameplan → Home strip → workout screens
```

**No OpenRouter / Edge call on the standard path.**

Post-workout recalibrate (`completeWorkout`, `flushPerformanceQueue`) uses the **same local engine** via `syncPerformanceQueueAndRecalibrate`.

### Hydration path (no gameplan race)

```
AuthProvider → hydrateLocalStoreFromRemote → hydrateFoundationFromRemote
Home (foundationComplete) → fetchDailyGameplanAsync
Command tab save → upsertSteeringWheelSettings → setUserBiological → fetchDailyGameplanAsync({ forceRefresh: true })
```

### Auth (minimal — DONE)

| Surface | Behavior |
|---------|----------|
| `app/(auth)/index.tsx` | **Email magic link only** — no Google OAuth button |
| `components/auth/EmailAuthPanel.tsx` | Email input + **Send magic link** (full-width); success state “Link dispatched” |
| Offline | **Begin Awakening** when Supabase env unset |

`signInWithGoogle` remains in `lib/supabase/auth.ts` / `AuthProvider` for legacy redirects only — **do not re-add Google UI** unless requested.

### Repo map (operational)

```
app/(auth)/index.tsx                              # welcome · EmailAuthPanel only
app/(tabs)/{home,mastery,analytics,profile}.tsx   # profile = Command · analytics = passport + telemetry
app/(workout)/{iron,combat,spirit,ascension,summary}.tsx
components/auth/EmailAuthPanel.tsx
components/iron/{RirSelector,LoadTelemetryStrip,ExerciseCueCard,TargetLoadBanner,...}.tsx
components/clinical/ReviewForm.tsx                # Exit Interview · telemetry-suggested RPE prefill
components/command-center/{CommandCenterShell,InstructionPanel}.tsx
components/combat/{ComboSequencePanel,CombatIntervalClock,RpeSelector}.tsx
components/spirit/{FlowStepper,FlowGestureZones,SanctuaryBreathOrb}.tsx
components/sanctuary/WeeklyMicrocycleStrip.tsx
lib/physics/{rmCalculator,loadTelemetry}.ts       # ACWR · sRPE · RPE σ · goal-aware thresholds
lib/gameplan/engine/
  performanceLogs.ts        # reported_rir → effective RPE for engine rows
  generateDeterministicGameplan.ts  # computeTrainingLoadSnapshot + telemetry autoreg
lib/gameplan/{fetchDailyGameplan,parseGameplan,microcycleValidation}.ts
lib/supabase/{client,authStorage.*,sync,profile}.ts
lib/haptics.{web,native}.ts · lib/audio/combatAudio.{web,native}.ts
store/useSommaStore.ts
types/performance.ts        # IronSetLog.target_rir + reported_rir
vercel.json · app.json        # web-only export (see §1)
supabase/migrations/021_profiles_granular_frequency.sql
```

---

## 2. Status — Text-Only Elite (DONE)

**Decision:** Coaching value is **typography-first** — biomechanical instructions, cues, prescriptions, timers. No movement media on the workout surface.

| Removed | Replacement |
|---------|-------------|
| `ModularMovementPlayer` · movement video pipeline | `InstructionPanel` + pillar panels |
| `expo-video` · `expo-image` (workout deps) | — |

**Do not re-introduce video/image workout dependencies unless explicitly requested.**

---

## 3. Granular pillar frequencies (V8)

### DB — migration `021`

Columns on `profiles`:

| Column | Range | Purpose |
|--------|------:|---------|
| `frequency_iron` | 0–7 | Iron blocks per microcycle |
| `frequency_combat` | 0–7 | Combat blocks per microcycle |
| `frequency_spirit` | 0–7 | Spirit blocks per microcycle |

Backfills from legacy `training_days_per_week`. Client syncs `training_days_per_week = max(frequencies)` on save.

### Command Center UI — `app/(tabs)/profile.tsx`

Tab label: **Command** (sliders icon).

- **ValueSteppers** for Iron / Combat / Spirit frequency (0–7 days/week)
- **Time budget** chips: 45m · 60m · 90m · Unlimited / Max Results → sets `available_time_*`
- **Save & Recalibrate Neural Link** → `upsertSteeringWheelSettings()` → Zustand → `fetchDailyGameplanAsync({ forceRefresh: true })`

Example athlete intent: Iron 6× · Spirit 6× · Combat 3× — pillars may share days or differ (no longer forced tri-pillar on every active day).

### TypeScript helpers (`types/biological.ts`)

- `PILLAR_FREQUENCY_MIN/MAX`, defaults, `TIME_BUDGET_PRESETS`
- `clampPillarFrequency`, `deriveTrainingDaysFromFrequencies`, `inferTimeBudgetPresetId`, `timeBudgetFromPresetId`

---

## 4. Local deterministic Head Coach ($0 API)

Hardcoded periodization in `lib/gameplan/engine/` — **no LLM** for standard generation.

| Rule domain | Implementation |
|-------------|----------------|
| **Weekly layout** | `spreadPillarDayIndices` per pillar; union of days = active days |
| **Iron splits** | Push / Pull / Legs / Upper / Lower / Full Body focus rotation → `selectExercisesForSplit` from `library_exercises` |
| **Hypertrophy volume** | `targetIronExerciseCount(minutes, goal_iron)` → 6–8 for hypertrophy/powerbuilding |
| **Mesocycle / load** | 21d logs → Epley E1RM, **reported RIR → RPE**, MEV/MRV set caps, CNS rest, injury/CNS autoreg swaps |
| **Load telemetry** | `computeTrainingLoadSnapshot` + `telemetrySuggestsPoorRecovery` | ACWR spike / chronic high RPE + low σ → `poor_recovery` |
| **ACWR bands (iron)** | `resolveAcwrThresholds(goal_iron)` | Strength tighter (spike ≥1.35) · Hypertrophy looser (≥1.52) · Combat fixed 1.50 |
| **Combat** | Tactical round plan (footwork → power → defense/burnout) from `library_combat` |
| **Spirit** | Healer 48h zones → flow from `library_flow_spirit`; breathwork fallback |
| **Validation** | Exact pillar block counts must match `frequency_*` or throws `DEGENERATE_MICROCYCLE` |

`fetchDailyGameplan` writes `daily_protocols.source = 'local'`. Home shows **Expert protocol** for `local` and `deterministic`.

### Edge function (optional / legacy)

- Client **does not invoke** Edge for gameplan fetch.
- Edge handler still has deterministic + `enforceGranularPillarSchedule` for server-side callers.
- LLM path runs **only** when `HEAD_COACH_USE_LLM=true` **and** `OPENROUTER_API_KEY` is set.
- Default: `HEAD_COACH_USE_LLM` unset → deterministic only, $0 API.

---

## 5. Catalog — ground truth

### Remote (project `<YOUR_PROJECT_REF>` — set in `.env`, never commit)

| Table | Rows | Notes |
|-------|-----:|-------|
| `library_exercises` | **1,514** | Equipment-filtered in engine |
| `library_combat` | **52** | `tactical_focus` on combos |
| `library_flow_spirit` | **70** | flow + spirit pillars |

Client cache: `somma-cache-library-*-v3`, TTL 12h.

**Seed rule:** Never `ON CONFLICT DO UPDATE SET id = excluded.id` — breaks `performance_logs.exercise_id` FK.

---

## 6. Command Center workout UI (pillars)

| Pillar | Surface | Data |
|--------|---------|------|
| **Iron** | `InstructionPanel` → `TargetLoadBanner` → `ExerciseCueCard` | `biomechanical_instructions` JSONB |
| **Combat** | `ComboSequencePanel` | `library_combat.sequence` + tactical focus |
| **Spirit** | `FlowStepper` | `library_flow_spirit` via `parseAsanaCatalog.ts` |

### Iron load UX

| State | UI |
|-------|-----|
| E1RM / logged history | Banner shows **X kg** + optional `loadHint` from last reported RIR |
| No history | **Calibrate First Set** — `target_weight_kg: null` |

### Iron RIR gate (bio-feedback — DONE)

```
Log Set → RirSelector (0–4) → Confirm set → rest / next set
```

| Field | Purpose |
|-------|---------|
| `IronSetLog.target_rir` | Prescribed RIR from Head Coach |
| `IronSetLog.reported_rir` | Athlete-reported RIR (drives telemetry) |
| `sync.ts` | `rpe_score = 10 - reported_rir` on `performance_logs` iron_set rows |

Combat keeps session-end `RpeSelector` (1–10). Spirit/combat unchanged.

### Internal load telemetry (DONE — $0 on-device)

| Metric | Window | Use |
|--------|--------|-----|
| **ACWR** | 7d acute / 28d chronic (sRPE) | Autoreg · gold highlight when elevated/spike |
| **RPE mean / σ** | 14d per pillar | Fatigue pattern detection |
| **Global RPE** | Iron + combat | Clinical Exit Interview prefill (`suggestedAverageRpeForClinicalReview`) |

| UI surface | Component |
|------------|-----------|
| Command tab | `LoadTelemetryStrip` · `goalIron` from steering draft |
| Analytics tab | `LoadTelemetryStrip` · `variant="detail"` (sRPE 7d + threshold caption) |
| Home (week 4) | `ReviewForm` · `suggestedAverageRpe` from telemetry |

**Do not** add LLM or wearable APIs for load — extend `loadTelemetry.ts` only.

---

## 7. Fixes landed (V7 → V8)

| Issue | Fix |
|-------|-----|
| Global `training_days_per_week` only — no per-pillar UI | `021` + Command Steering Wheel tab |
| LLM cost + latency for every week | Local `lib/gameplan/engine/` — primary path |
| Tri-pillar forced on every training day | Granular frequencies; pillars on independent day spreads |
| Edge enforcer ignored granular freqs | `enforceGranularPillarSchedule` (Edge); local engine native |
| Recalibrate still hit Edge | `sync.ts` + store pass biological/stats/logs to local fetch |
| Iron `rir` was prescribed only, not athlete-reported | Post-set **RIR gate** + `reported_rir` in logs/sync |
| No ACWR / session load math | `lib/physics/loadTelemetry.ts` → Head Coach + Command/Analytics UI |
| Vercel Hermes / native bin errors on export | `platforms: ["web"]` · `output: single` · `.web.ts` shims · `vercel.json` |
| Cluttered auth (Google + email tiles) | **Email magic link only** on welcome screen |

---

## 8. Known debt

| Area | Status |
|------|--------|
| Migration `021` | **Local file** — run `npx supabase db push` on remote |
| Session changes | Likely **uncommitted** — verify `git status` |
| Edge deploy | Optional unless server-side generation needed |
| Catalog `setup` phase keys | ~1,100+ iron rows still need `import_catalog.py` regen |
| Cached `daily_protocols` with old `ai` source | User must **Recalibrate** or `forceRefresh` after frequency changes |

### Apply migration (Windows)

```powershell
npx supabase db push
```

### Optional Edge deploy (LLM off by default)

```powershell
npx supabase functions deploy generate_weekly_microcycle generate_daily_protocol
```

---

## 9. Pending action (next session)

1. **Apply migration 021** and confirm `profiles.frequency_*` columns on remote.
2. **Commit** session bundle: telemetry, RIR gate, Vercel web config, email-only auth.
3. **Regression:** Iron set → RIR gate → `performance_logs.rpe_score` · Command/Analytics telemetry lines · ACWR gold on spike · Exit Interview RPE prefill · `npm run build` → `dist/index.html`.
4. **Regression (core):** Command save → pillar block counts · post-workout recalibrate stays local · `gameplan_source === 'local'`.
5. **Catalog:** Regenerate `setup` phase keys where `merged_steps` empty.
6. **`npx tsc --noEmit`** + **`npm run build`** before Vercel push.

---

## 10. Fresh-session checklist

1. Read **§2 Text-Only Elite** — do not rebuild video pipeline.
2. Read **§4 Local Head Coach** — default path is **client engine**, not Edge/LLM.
3. Read **§6 RIR gate + load telemetry** — extend `loadTelemetry.ts`, not LLM/wearables.
4. Migrations **001–021**; `021` = granular pillar frequency columns.
5. Profile must have `frequency_iron/combat/spirit` + time budgets (Command tab or backfill from `training_days_per_week`).
6. Catalog cache v3 populated (`prefetchLibraryCatalogs` on Home).
7. Auth welcome = **email magic link only** (no Google button).
8. `OPENROUTER_API_KEY` only needed if explicitly enabling `HEAD_COACH_USE_LLM=true` on Edge.
9. `npx tsc --noEmit` before client ship.
10. **Vercel:** `npm run build` must emit `dist/index.html` + `_expo/static/*` with **zero** errors; do not add iOS/Android to `app.json` `platforms` for CI.

---

*End of Context Anchor V8.*
