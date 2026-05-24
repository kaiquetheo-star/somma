# SOMMA — Context Anchor V7

**Paste or `@CONTEXT_ANCHOR_V7.md` at the start of every new session.** This file supersedes V6 on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — The Longevity OS |
| **North star** | SHRED-level performance for ~6×/week athletes |
| **Checkpoint** | May 2026 — Text-Only Elite client · tri-pillar Command Centers · Head Coach brain upgraded (local) · migrations **001–020** |
| **Prior anchors** | V1–V6 — historical only |
| **Last commit** | `a30cfaf` — Combat/Spirit command centers + migration renumbering (`master`) |
| **Deploy gate** | Edge Head Coach fixes are **local** until `npx supabase functions deploy` |

---

## 1. Architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Client** | **Expo SDK 54** · RN 0.81 · React 19 · **Expo Router** v6 | `(auth)` · `(tabs)` · `(workout)` |
| **Styling** | **NativeWind v4** + Tailwind 3 | Obsidian `#0F1512` / `#0A0E0C` · Matte Gold `#BFA06A` |
| **State** | **Zustand** + `AsyncStorage` (`somma-offline-store`) | Offline-first gameplan, logs, performance queue |
| **Sync** | `lib/supabase/sync.ts` | Per-set + block-complete → `performance_logs`; block finish → Head Coach recalibrate |
| **Backend** | **Supabase** | **Postgres** · Auth · RLS · **Edge Functions** |
| **AI** | **`generate_weekly_microcycle`** (canonical entry) · **`generate_daily_protocol`** (shared handler) | OpenRouter LLM + deterministic pre/post engines |

### Zustand contract (key fields)

| Field | Purpose |
|-------|---------|
| `weeklyMicrocycle` | 7-day `MicrocycleDay[]` (Mon–Sun) |
| `selectedDayIndex` | Active strip day (1–7) |
| `performance_logs` / `performanceQueue` | Local history + pending Supabase sync |
| `lastWorkoutSummary` | Post-workout Ascension metrics |
| `user_biological` | Passport + `training_days_per_week` + pillar time budgets |
| `gameplan_error` | Surfaces Head Coach failures (no silent stub when Supabase configured) |
| `logIronSet` / `completeWorkout` | Per-set sync + block finish → recalibrate |
| `hydrateFoundationFromRemote` | **Remote profile sync only** — no stub gameplan (Home owns fetch) |
| `completeFoundationScan` | **Onboarding only** — writes stub gameplan then `fetchDailyGameplanAsync` replaces it |

### Head Coach data path

```
fetchDailyGameplan → generate_weekly_microcycle (delegates to generate_daily_protocol handler)
  → daily_protocols.microcycle (jsonb) → parseGameplan → Home strip → workout screens
```

**Post-generation pipeline (Edge, before upsert):**

```
LLM or buildDeterministicMicrocycle
  → enforceTriPillarHybridDays()      # Iron + Combat HIIT + Spirit on every training day
  → reconcileIronTargetWeightsInMicrocycle()  # null load when no performance_logs
  → upsert daily_protocols
```

### Hydration path (no gameplan race)

```
AuthProvider → hydrateLocalStoreFromRemote → hydrateFoundationFromRemote (profile/stats/equipment)
Home (foundationComplete) → fetchDailyGameplanAsync (sole owner of weeklyMicrocycle)
```

### Repo map (operational)

```
app/(tabs)/home.tsx
app/(workout)/{iron,combat,spirit,ascension,summary}.tsx
components/command-center/{CommandCenterShell,InstructionPanel}.tsx
components/iron/{ExerciseCueCard,TargetLoadBanner,RestTimerOverlay,ValueStepper}.tsx
components/combat/{ComboSequencePanel,CombatIntervalClock,RpeSelector}.tsx
components/spirit/{FlowStepper,FlowGestureZones,SanctuaryBreathOrb}.tsx
components/sanctuary/WeeklyMicrocycleStrip.tsx
hooks/{useRealtimeSync,useUserStatsRealtime}.ts
lib/gameplan/{fetchDailyGameplan,parseGameplan,microcycleValidation}.ts
lib/iron/{resolveExercise,instructionCues}.ts
lib/physics/rmCalculator.ts              # client E1RM — null when no logs
lib/spirit/parseAsanaCatalog.ts
lib/catalog/library.ts                     # explicit selects, cache v3
lib/supabase/{client,sync,profile}.ts
store/useSommaStore.ts
scripts/{import_catalog.py,apply_catalog_seed_batches.py}
supabase/functions/_shared/rmCalculator.ts   # Edge E1RM + resolvePrescriptionTargetWeight
supabase/functions/generate_daily_protocol/index.ts
supabase/functions/generate_weekly_microcycle/index.ts  # thin delegate → shared handler
supabase/migrations/{001..020}_*.sql       # 020 = no-op (017 supersedes elite seed)
```

---

## 2. Status — Text-Only Elite (DONE on client)

**Decision:** Coaching value is **typography-first** — biomechanical instructions, cues, prescriptions, timers. No movement media on the workout surface.

| Removed (V6 audit) | Replacement |
|--------------------|-------------|
| `ModularMovementPlayer` · `lib/visual/resolveMovementSource.ts` | `InstructionPanel` + pillar panels |
| `expo-video` · `expo-image` (workout deps) | — |
| `visual_asset_*` on client / Edge selects | Text from catalog JSONB + descriptions |
| Edge `<AVAILABLE_ASSETS>` visual fields | Stripped from LLM payload |

**Do not re-introduce video/image workout dependencies unless explicitly requested.**

---

## 3. Catalog — ground truth & live DB

### Sources → `scripts/import_catalog.py`

| Source | Content |
|--------|---------|
| **Wger** | Names, descriptions, muscles, equipment |
| **ExerciseDB CSV** | Step instructions, body part, equipment |
| **Yoga JSON** | Pose names, descriptions (Spirit/Flow) |

### Ingestion JSONB shape (`library_exercises.biomechanical_instructions`)

`map_merged_steps_to_phase_keys()` maps step count → phase keys (`setup`, `eccentric`, `concentric`, `safety`, `regression`). Always retains `merged_steps`, `sources`, optional `summary`.

### Remote catalog (project `motyiykvtguibjevhusd`)

| Table | Rows | Notes |
|-------|-----:|-------|
| `library_exercises` | **1,514** | **1,486** InstructionPanel-ready |
| `library_combat` | **52** | |
| `library_flow_spirit` | **70** | `session_name` often `English (Sanskrit)` |

**Gap:** ~28 stub rows with empty `merged_steps` — Iron shows default command copy.

**Seed upsert rule:** Never `ON CONFLICT DO UPDATE SET id = excluded.id` — breaks `performance_logs.exercise_id` FK.

```bash
pip install -r scripts/requirements-catalog.txt
python scripts/import_catalog.py
python scripts/apply_catalog_seed_batches.py
```

---

## 4. Command Center UI (all pillars wired — `a30cfaf`)

Shared chrome: `CommandCenterShell` → pillar panel → timers / logging.

| Pillar | Component | Data |
|--------|-----------|------|
| **Iron** | `InstructionPanel` → `TargetLoadBanner` → `ExerciseCueCard` | `library_exercises.biomechanical_instructions` |
| **Combat** | `ComboSequencePanel` | `library_combat.sequence` + tactical focus |
| **Spirit** | `FlowStepper` | `library_flow_spirit` via `parseAsanaCatalog.ts` |

### Iron target load UX

| State | UI |
|-------|-----|
| `target_weight_kg` from prescription or E1RM | Banner shows **X kg** |
| No `performance_logs` for movement | Banner shows **Calibrate First Set** (not a flat 21/27 kg guess) |

Client: `getTargetWeight()` in `lib/physics/rmCalculator.ts` returns `null` without history.  
Edge: `prescribeIronExercise()` removed `body_mass × 0.35` fallback; `reconcileIronTargetWeightsInMicrocycle()` strips bogus LLM weights.

---

## 5. Head Coach brain (local — deploy required)

### Hypertrophy volume

- System prompt **CRITICAL HYPERTROPHY RULE**: 6–8 iron exercises per training day; supersets when `available_time_iron` is tight; clean names (no `1.` prefixes).
- `targetIronExerciseCount(minutes, goalIron)` → **6–8** for hypertrophy/powerbuilding (was ~4 at 45 min).

### Tri-pillar hybrid scheduling

Every **training day** (not rest days) must include:

| Order | Block | Role |
|-------|-------|------|
| 0 | **Iron** | Main hypertrophy/strength work |
| 1 | **Combat** | Post-iron HIIT finisher (`Blood & Bone · HIIT Finisher`) |
| 2 | **Spirit** | Active recovery / flow (`Sanctuary · Active Recovery`) |

Implemented in:

- `buildHybridTrainingDayBlocks()` — deterministic week builder
- `enforceTriPillarHybridDays()` — patches AI weeks missing Combat/Spirit
- System prompt **HYBRID SCHEDULING LAW**

Rest days: `is_rest_day: true`, `blocks: []`.

### E1RM / load law

- Load only from **Epley E1RM** or **logged sets** in `performance_logs` (21d window).
- **Never** estimate `target_weight_kg` from body mass.
- Prompt: `target_weight_kg: null` + progression_note "Calibrate first set @ prescribed RIR" when no history.

### Pillar goals (DB)

`019_pillar_goals_constraints.sql` uses **length-only** CHECKs (≤120 chars) — onboarding allows free-text + preset chips from `PILLAR_GOAL_PRESETS` in `types/biological.ts`. Do not re-add enum CHECKs.

---

## 6. Fixes landed (V6 → V7)

| Issue | Fix |
|-------|-----|
| Realtime subscribe race | `hooks/useRealtimeSync.ts` |
| Schema cache / column errors | `lib/supabase/client.ts` + catalog explicit selects v3 |
| Hydration race (stub overwrites AI gameplan) | `hydrateFoundationFromRemote` decoupled from onboarding scan |
| Edge visual token waste | Visual columns stripped from catalog + `<AVAILABLE_ASSETS>` |
| Duplicate migration prefixes | `018` combat tactical · `019` goal length checks · `020` no-op |
| `019` enum CHECK vs free-text goals | Length-only constraints |
| `020` seed FK violation | No-op (017 global seed) |
| Flat 27 kg all exercises | Removed body-mass fallback; Calibrate First Set UI |
| 4-exercise hypertrophy sessions | 6–8 exercise rule + goal-aware count |
| Combat/Spirit only on rest days | Tri-pillar hybrid enforcement |

---

## 7. Known debt

### Uncommitted / not deployed

| Area | Status |
|------|--------|
| Head Coach Edge changes | **Local** — must deploy |
| Text-Only Elite remainder | `iron.tsx`, store, deleted `ModularMovementPlayer`, `016`/`017` migrations, etc. — may still be unstaged |
| Catalog phase keys | Re-run `import_catalog.py` for `setup` on ~1,100+ rows |

### Deploy Edge (required for new brain)

```powershell
npx supabase functions deploy generate_weekly_microcycle generate_daily_protocol
```

Then **recalibrate** on device (Home refresh / new `fetchDailyGameplan`) — old protocols keep 4-exercise / flat-kg until replaced.

### Supabase CLI (Windows)

```powershell
npx supabase db push
npx supabase migration repair --status applied <version>
```

---

## 8. Pending action (next session)

1. **Deploy Edge functions** (§7) and verify fresh microcycle: 6–8 iron moves · tri-pillar blocks · null/calibrated loads.
2. **Commit** remaining Text-Only Elite + Head Coach bundle if still unstaged.
3. **Regenerate catalog** for `setup` phase keys on iron rows.
4. **Regression:** Home strip · `gameplan_error` · `training_days_per_week` · pillar time budgets · Iron Calibrate banner · Combat timer · Spirit flow holds · log first set → E1RM appears on next recalibrate.

---

## 9. Fresh-session checklist

1. Read **§2 Text-Only Elite** — do not rebuild video pipeline.
2. Read **§5 Head Coach** — hybrid days + hypertrophy count + null loads are Edge-only until deployed.
3. Catalog **017** on remote (1,514 exercises).
4. Migrations **001–020** unique; `020` is no-op.
5. `OPENROUTER_API_KEY` set in Supabase Edge secrets.
6. Profile has `training_days_per_week`, pillar time columns, optional `goal_iron` (hypertrophy triggers 6–8 rule).
7. `npx tsc --noEmit` before client ship.

---

*End of Context Anchor V7.*
