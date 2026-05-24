# SOMMA — Context Anchor V6

**Paste or `@CONTEXT_ANCHOR_V6.md` at the start of every new session.** This file supersedes V5 on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — The Longevity OS |
| **North star** | SHRED-level performance for ~6×/week athletes |
| **Checkpoint** | May 2026 — **Text-Only Elite** pivot; catalog ingestion + Command Center UI in flight |
| **Prior anchors** | V1–V5 — historical only |

---

## 1. Architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Client** | **Expo SDK 54** · RN 0.81 · React 19 · **Expo Router** v6 | `(auth)` · `(tabs)` · `(workout)` |
| **Styling** | **NativeWind v4** + Tailwind 3 | Obsidian `#0F1512` / `#0A0E0C` · Matte Gold `#BFA06A` |
| **State** | **Zustand** + `AsyncStorage` (`somma-offline-store`) | Offline-first gameplan, logs, performance queue |
| **Sync** | `lib/supabase/sync.ts` | Per-set + block-complete → `performance_logs`; optional Head Coach recalibrate via `fetchDailyGameplan` |
| **Backend** | **Supabase** | **Postgres** · Auth · RLS · **Edge Functions** |
| **AI** | **`generate_weekly_microcycle`** (canonical) · **`generate_daily_protocol`** (shared handler) | OpenRouter LLM + deterministic pre/post engines |

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

### Head Coach data path

```
fetchDailyGameplan → generate_weekly_microcycle (fallback: generate_daily_protocol)
  → daily_protocols.microcycle (jsonb) → parseGameplan → Home strip → workout screens
```

### Repo map (operational)

```
app/(tabs)/home.tsx                    # 7-day strip + selected day blocks
app/(workout)/{iron,combat,spirit,ascension,summary}.tsx
components/iron/ExerciseCueCard.tsx    # Text cues / biomechanical copy
components/sanctuary/WeeklyMicrocycleStrip.tsx
hooks/useUserStatsRealtime.ts          # Realtime user_stats (known crash surface)
lib/gameplan/{fetchDailyGameplan,parseGameplan,microcycleValidation}.ts
lib/supabase/{sync,profile,invokeEdgeFunction}.ts
lib/physics/rmCalculator.ts            # Epley E1RM + getTargetWeight
scripts/import_catalog.py              # Massive text/catalog ingestion → SQL migration
store/useSommaStore.ts
supabase/functions/generate_daily_protocol/index.ts
supabase/migrations/017_global_catalog_seed.sql   # Generated global catalog (re-run import)
```

---

## 2. Status — Text-Only Elite

**Decision:** SOMMA migrated to a **Text-Only Elite** architecture. Movement demos, video loops, GIF players, and Storage streaming were **removed from the product surface**. The app is now **ultra-lightweight**: coaching value comes from **biomechanical instructions, cues, prescriptions, and timers** — not media playback.

| Before (V5) | Now (V6) |
|-------------|----------|
| `ModularMovementPlayer` · `expo-video` · `expo-image` loops | **Typography-first** cue cards and instruction panels |
| `visual_asset_url` required for workout UX | **Optional / deprecated** in UI; DB columns may remain for future |
| Heavy catalog asset pipeline | **Text ingestion** as ground truth |

**Implication for new work:** Do not re-introduce video/image dependencies unless explicitly requested. Prefer `biomechanical_instructions` JSONB, `ExerciseCueCard`, and pillar-specific command UI.

---

## 3. Data source — ground truth

Open-source datasets live under `datasets/` and feed **`scripts/import_catalog.py`**:

| Source | Location (typical) | Content ingested |
|--------|-------------------|------------------|
| **Wger Project** | `datasets/wger-master/wger/exercises/fixtures/` | Exercise names, descriptions, muscles, equipment (`exercise-base-data.json` + `translations.json`) |
| **ExerciseDB CSV** | `datasets/final_exercise_dataset.csv` (or `exercises.csv`) | Target/secondary muscles, step instructions, body part, equipment |
| **Yoga JSON** | `datasets/Poses.json` | English + Sanskrit names, pose descriptions (Spirit/Flow) |

**Ingestion output:** `supabase/migrations/017_global_catalog_seed.sql` — batched `INSERT … ON CONFLICT (slug) DO UPDATE` into:

- `library_exercises` — `biomechanical_instructions` (JSONB), muscles, equipment
- `library_combat` — combo sequences + tactical metadata
- `library_flow_spirit` — session copy, recovery zones, hold durations

**Run locally (no DB connection):**

```bash
pip install -r scripts/requirements-catalog.txt
python scripts/import_catalog.py
# Apply: supabase db push or SQL Editor (500-row batches)
```

Merge logic deduplicates by **slug / normalized name** and combines instruction text from multiple sources into rich JSONB.

---

## 4. Current goal

### A. Ingest text-only catalog into Postgres
1. Run `import_catalog.py` against full `datasets/` tree.
2. Apply `017_global_catalog_seed.sql` (or successor migration).
3. Verify Edge Head Coach reads `biomechanical_instructions` from catalog — not invented copy.
4. Ensure `parseGameplan` / workout resolvers surface instruction fields on prescriptions.

### B. Complete the **Command Center** UI (Iron · Combat · Spirit)
Per-pillar workout screens should behave as **command centers** — not media players:

| Pillar | Command Center focus |
|--------|---------------------|
| **Iron** | Exercise queue, target load (E1RM), sets/reps/RIR, **biomechanical cue cards**, rest timer |
| **Combat** | Round structure, tactical focus labels, interval clock, combo sequence text |
| **Spirit** | Flow/breath mode, hold timers, recovery zone copy, sequence stepper |

Target files: `app/(workout)/iron.tsx`, `combat.tsx`, `spirit.tsx` + `components/iron/ExerciseCueCard.tsx` and pillar-specific shells.

---

## 5. Pending action (next session)

Perform a **deep codebase audit** in this order:

### 1. Remove unused media components & dependencies
- Delete or orphan: `ModularMovementPlayer`, `lib/visual/resolveMovementSource.ts`, `expo-video` / heavy image loop usage in workout flows.
- Strip `visual_asset_*` from client render paths (Edge may still emit; client ignores).
- Remove Storage bucket assumptions from UI if no longer used.
- Run `npx tsc --noEmit` after cleanup.

### 2. Fix Realtime crash
- **Error:** `cannot add postgres_changes callbacks for realtime:user_stats... after subscribe()`
- **File:** `hooks/useUserStatsRealtime.ts` (used from `app/(tabs)/home.tsx`)
- **Fix pattern:** Attach all `.on()` listeners **before** `.subscribe()`; dedupe channels on mount; avoid `setUserStats` in effect deps (use `getState()`).

### 3. Finalize biomechanical instructions UI
- Wire `library_exercises.biomechanical_instructions` → Iron `ExerciseCueCard` (setup / eccentric / concentric / safety or merged steps).
- Spirit: description + tempo_profile copy; Combat: sequence + tactical intent strings.
- Empty-state typography when catalog row has minimal JSONB — never blank screen.

### 4. Regression checks
- Home 7-day microcycle strip still drives day selection.
- Head Coach generates training days matching `training_days_per_week` (not all-rest week).
- `gameplan_error` surfaces on Edge failure when Supabase configured.
- Pillar time budgets (`available_time_iron/combat/spirit`) honored in Edge prompt.

---

## 6. Fresh-session checklist

1. Read **§2 Text-Only Elite** — do not rebuild video pipeline.
2. Confirm migrations through **016+** applied; catalog seed **017** applied or re-generated from `datasets/`.
3. Edge deployed: `supabase functions deploy generate_weekly_microcycle generate_daily_protocol`.
4. Verify `OPENROUTER_API_KEY` + profile `training_days_per_week` + pillar time columns.
5. Prioritize **Command Center UI + text ingestion** over media polish.

---

*End of Context Anchor V6.*
