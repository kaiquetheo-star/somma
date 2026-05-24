# SOMMA — Context Anchor V8

**Paste or `@CONTEXT_ANCHOR_V8.md` at the start of every new session.** This file supersedes V7 on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — The Longevity OS |
| **North star** | SHRED-level performance for ~6×/week athletes |
| **Checkpoint** | May 2026 — Text-Only Elite · **local $0 Head Coach** · granular pillar frequencies · migrations **001–021** |
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
| **Backend** | **Supabase** | Postgres · Auth · RLS · catalog tables · `daily_protocols` cache |
| **Edge (legacy / optional)** | `generate_weekly_microcycle` → `generate_daily_protocol` | Deterministic by default; LLM only if `HEAD_COACH_USE_LLM=true` |

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

### Repo map (operational)

```
app/(tabs)/{home,mastery,analytics,profile}.tsx   # profile = Command Center "Steering Wheel"
app/(workout)/{iron,combat,spirit,ascension,summary}.tsx
components/command-center/{CommandCenterShell,InstructionPanel}.tsx
components/iron/{ExerciseCueCard,TargetLoadBanner,RestTimerOverlay,ValueStepper}.tsx
components/combat/{ComboSequencePanel,CombatIntervalClock,RpeSelector}.tsx
components/spirit/{FlowStepper,FlowGestureZones,SanctuaryBreathOrb}.tsx
components/sanctuary/WeeklyMicrocycleStrip.tsx
lib/gameplan/engine/
  constants.ts              # MEV/MRV, focus rotations, spirit tempos
  periodization.ts          # pillar frequencies, split patterns, exercise selection
  prescription.ts           # iron / combat / spirit block builders
  performanceLogs.ts        # Zustand logs → engine rows
  generateDeterministicGameplan.ts
lib/gameplan/{fetchDailyGameplan,parseGameplan,microcycleValidation}.ts
lib/physics/rmCalculator.ts
lib/catalog/library.ts      # explicit selects, AsyncStorage cache v3
lib/supabase/{client,sync,profile}.ts
store/useSommaStore.ts
types/biological.ts         # frequencies, TIME_BUDGET_PRESETS, deriveTrainingDaysFromFrequencies
supabase/migrations/021_profiles_granular_frequency.sql
supabase/functions/generate_daily_protocol/index.ts   # LLM gated; enforceGranularPillarSchedule
supabase/functions/generate_weekly_microcycle/index.ts
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
| **Mesocycle / load** | 21d logs → Epley E1RM, RIR, MEV/MRV set caps, CNS rest, injury/CNS autoreg swaps |
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

### Remote (project `motyiykvtguibjevhusd`)

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
| E1RM / logged history | Banner shows **X kg** |
| No history | **Calibrate First Set** — `target_weight_kg: null` |

---

## 7. Fixes landed (V7 → V8)

| Issue | Fix |
|-------|-----|
| Global `training_days_per_week` only — no per-pillar UI | `021` + Command Steering Wheel tab |
| LLM cost + latency for every week | Local `lib/gameplan/engine/` — primary path |
| Tri-pillar forced on every training day | Granular frequencies; pillars on independent day spreads |
| Edge enforcer ignored granular freqs | `enforceGranularPillarSchedule` (Edge); local engine native |
| Recalibrate still hit Edge | `sync.ts` + store pass biological/stats/logs to local fetch |

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
2. **Commit** V8 bundle: engine, profile tab, `021`, fetch path, Edge gate.
3. **Regression:** Command tab save → strip shows correct Iron/Combat/Spirit day counts · split labels on iron days · Combat 3× week only has 3 combat blocks · Spirit flow/breathwork on spirit days · post-set recalibrate stays local · `gameplan_source === 'local'`.
4. **Catalog:** Regenerate `setup` phase keys where `merged_steps` empty.
5. **`npx tsc --noEmit`** before ship.

---

## 10. Fresh-session checklist

1. Read **§2 Text-Only Elite** — do not rebuild video pipeline.
2. Read **§4 Local Head Coach** — default path is **client engine**, not Edge/LLM.
3. Migrations **001–021**; `021` = granular pillar frequency columns.
4. Profile must have `frequency_iron/combat/spirit` + time budgets (Command tab or backfill from `training_days_per_week`).
5. Catalog cache v3 populated (`prefetchLibraryCatalogs` on Home).
6. `OPENROUTER_API_KEY` only needed if explicitly enabling `HEAD_COACH_USE_LLM=true` on Edge.
7. `npx tsc --noEmit` before client ship.

---

*End of Context Anchor V8.*
