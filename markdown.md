# SOMMA — Unified Specification (SRS · SAD · FSD)

**Project:** SOMMA (The Longevity OS)  
**Format:** Markdown (`.md`) — single source of truth for product, architecture, and implementation  
**Stack:** Expo SDK 54 · TypeScript · Expo Router · NativeWind v4 · Zustand · Supabase · OpenRouter  
**Checkpoint reference:** `CONTEXT_ANCHOR_V5.md` (implementation status)

*Markdown is the canonical spec format: headers and lists parse reliably for humans and AI assistants.*

---

# Part I — Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for **SOMMA (The Longevity OS)**: an ultra-premium, adaptive fitness and biological alchemy application. It guides engineering, design, and AI-assisted development (Cursor) toward a coherent product that is safe, data-driven, and visually refined.

### 1.2 Scope

SOMMA is a **cross-platform** application built with **React Native (Expo)**. It must run with equal architectural seriousness on:

- **Native mobile** (iOS and Android via Expo Go or dev builds)
- **Web** (modern browsers via Expo web export)

It functions as a Longevity Operating System wrapped in a luxury RPG framework. Static workout PDFs are replaced by an **Adaptive Protocol Engine** that adjusts daily blocks based on:

- Pre-defined exercise and combo **libraries** (never hallucinated movement names)
- User **Biological Passport** data (age, mass, injuries, stress)
- **Performance logs** and RPE from prior sessions
- Available **equipment** and pillar focus ratios

Four pillars anchor the experience:

| Pillar | Mode | Primary outcome |
|--------|------|-----------------|
| **Iron** | Strength / hypertrophy | Progressive overload from `performance_logs` + body mass |
| **Blood & Bone** | Combat conditioning | Reflex rounds from `library_combat` combos |
| **Flow** | Yoga / mobility | Joint longevity, breath-linked movement |
| **Spirit** | Breathwork / NSDR | Nervous system regulation, recovery |

### 1.3 Definitions

- **Custom Gameplan / Daily Command:** The ordered list of workout blocks for the current calendar day.
- **Foundation Scan:** Onboarding questionnaire (pillar focus, biological passport, equipment).
- **Biological Passport:** Anthropometric and wellness baseline stored on `profiles` and injected into AI context.
- **Multiple Experts Engine:** Edge Function orchestration where the LLM acts as a **Chess Master** arranging catalog IDs—not inventing exercises.
- **Ascension Flare:** Mandatory 3-second completion ritual before returning to the Sanctuary.

---

## 2. Overall Description

### 2.1 Target audience

Class-A individuals, biohackers, and high performers who value extreme personalization, **Quiet Luxury** aesthetics, and biological mastery over generic fitness gamification.

### 2.2 Operating environment

| Platform | Requirement |
|----------|-------------|
| **iOS / Android** | Primary targets; haptics, SecureStore session persistence, full-screen workout lock |
| **Web** | First-class citizen; localStorage auth adapter, CORS-compliant Edge Functions, no SecureStore |
| **Offline** | Workout execution and local logging without network; queue sync on reconnect |
| **Online** | Supabase Auth, Postgres, Edge Functions, OpenRouter for protocol generation |

**REQ-ENV-1 (Cross-Platform):** A single Expo codebase shall implement **platform adapters** where native APIs differ (auth storage, deep links, back button). Feature behavior must degrade gracefully on web without dead-end UI states.

**REQ-ENV-2 (Web Auth):** On web, session tokens shall persist via `localStorage` (or equivalent), not `expo-secure-store`.

**REQ-ENV-3 (Web API):** All Supabase Edge Functions invoked from the browser shall return proper **CORS** headers, including successful handling of `OPTIONS` preflight requests.

### 2.3 Core mechanics (product)

1. **Encyclopedia-first movement data** — Iron exercises and combat combos exist only in seeded database tables.
2. **Chess Master AI** — The LLM selects IDs, sets, loads, round pairings, and recovery duration; it does not author new exercise names.
3. **Biological context** — Age (from DOB), weight, height, injuries, and stress inform volume and intensity caps.
4. **Offline-first execution** — Zustand + AsyncStorage hold gameplans, logs, and sync queues; Supabase syncs asynchronously after Ascension.

---

## 3. Functional Requirements

### 3.1 Onboarding: Foundation Scan

**REQ-1.1:** The system shall provide a multi-step, premium questionnaire (not gamified trivia).

**REQ-1.2 (Step I — Attunement):** The user shall select pillar focus ratio (Iron, Combat, Flow, Spirit) as percentage weights summing to 100.

**REQ-1.3 (Step II — Biological Passport):** The system shall capture:

- `date_of_birth` (ISO date)
- `weight_kg`, `height_cm`
- `body_fat_percentage` (optional)
- `current_injuries` (optional free text)
- `baseline_stress_level` (integer 1–10)

**REQ-1.4 (Step III — Environment):** The user shall select all available equipment tags (bodyweight, dumbbells, kettlebell, barbell, pull-up bar, heavy bag, full gym).

**REQ-1.5:** On completion, data shall persist to Zustand (offline) and Supabase (`profiles`, `user_environment`, `user_stats` seed).

**REQ-1.6:** The system shall trigger initial daily protocol generation via Edge Function `generate_daily_protocol` when online.

**REQ-1.7:** Users without completed foundation data shall be redirected from Sanctuary tabs to Foundation Scan (smart routing guard).

### 3.2 Sanctuary (Home & Dashboard)

**REQ-2.1 [Daily Command]:** Home shall display today's protocol blocks as **glassmorphism cards** on Obsidian (`#0F1512`), reading from `currentGameplan` in Zustand.

**REQ-2.2 [Recalibrate]:** User may force-refresh today's protocol via Edge Function (equipment + focus sent in body).

**REQ-2.3 [Attunement Orbs]:** Visual representation of essence scores; may pulse from `user_stats` (Realtime optional, future).

**REQ-2.4 [Empty state]:** Incomplete foundation shall show an interactive card routing to Foundation Scan—not a dead, non-clickable panel.

**REQ-2.5 [Mastery / Analytics]:** Constellation map and biomarker charts per roadmap; session reset and sign-out live under Analytics.

### 3.3 Workout engine (execution)

**REQ-3.1 [Iron Mode]:**

- Shall render exercises from **`library_exercises`** via IDs in the gameplan `iron.exercises[]` payload.
- Shall apply **progressive overload** from `performance_logs` (weight/reps adjustments); AI assigns targets only within locked routine structure.
- Shall provide set logging, rest timer with haptics (native), and **Adapt** swap within library alternatives.
- Shall not invent exercise names in UI or logs—UUID/slug must reference catalog.

**REQ-3.2 [Blood & Bone Mode]:**

- Shall display combos from **`library_combat`** via `combat.rounds[].combo_id` in gameplan.
- Shall run interval timer (work/rest); combo sequence shown as large, legible text.
- Shall filter combo difficulty by `combat_mastery` vs `complexity_level`.
- Post-session **RPE (1–10)** required before Ascension.

**REQ-3.3 [Spirit / Flow Mode]:**

- Shall run breathwork visualizer (Reanimated orb) with tempos from protocol or `library_flow_spirit` catalog.
- Flow (yoga) sequences per roadmap; Spirit breathwork is MVP priority.

**REQ-3.4 [Ascension Flare]:**

- Shall lock navigation for **3 seconds** (gesture back disabled on native).
- Visual: **simple, sober** Obsidian screen with subtle matte-gold radial glow—**no** full-screen harsh color flashes or brutalist bars.
- Shall run `completeWorkout` sync in background inside try/catch.
- **REQ-3.4a:** User **must** return to `/(tabs)/home` after 3 seconds whether sync succeeds or fails (graceful degradation).

### 3.4 Data logging & AI feedback loop

**REQ-4.1:** Each session shall append to local `performance_logs` and enqueue `performanceQueue` for Supabase insert.

**REQ-4.2:** `performance_logs` rows shall include pillar, optional `exercise_id` (FK), weight, reps, RPE, volume, block_id, JSON payload.

**REQ-4.3:** On sync success, Edge Function **`generate_daily_protocol`** recalibrates today's (or next) protocol using logs + biological passport + libraries.

**REQ-4.4:** Invalid LLM output shall be sanitized (ID allowlists) or replaced by deterministic fallback—user never sees an empty day.

### 3.5 Analytics & mastery (roadmap)

**REQ-5.1 [Unified Constellation]:** Draggable star map, achievement nodes (future).

**REQ-5.2 [Biological Passport UI]:** Edit and visualize passport fields + biomarkers + exam uploads (future charts).

---

## 4. Non-Functional Requirements

### 4.1 UI/UX — Quiet Luxury (mandatory)

**Aesthetic:** Quiet Luxury only—simple, sober, elegant. The app shall feel like a private members' wellness club, not a gaming HUD or brutalist prototype.

| Rule | Requirement |
|------|-------------|
| **Color** | Obsidian `#0F1512` base; Matte Gold `#BFA06A` accents; moss translucency for glass cards |
| **Forbidden** | Harsh full-screen neon flashes, broken yellow loading bars, comic sans, bounce easing, clutter |
| **Typography** | Playfair Display (display); Inter (body/data) |
| **Motion** | Slow, deliberate (Reanimated); Ascension = soft radial fade, not aggressive fills |
| **Loading** | Spinners and copy shall be minimal; never trap user on infinite loaders |
| **Fallback** | Offline/error states use same visual language—never raw system alerts as primary UI |

**REQ-UX-1:** Every interactive control shall have a defined `onPress` or shall be disabled with explanation; no dead buttons.

**REQ-UX-2:** Glass cards use `bg-white/5` or equivalent translucency—not heavy brutalist borders.

### 4.2 Performance

**REQ-PERF-1:** 60 FPS target for timers and breath orb.

**REQ-PERF-2:** Workout tick updates shall not re-render entire screen trees.

### 4.3 Security & privacy

**REQ-SEC-1:** RLS on all user tables—users read/write only their rows.

**REQ-SEC-2:** Library tables are read-only for authenticated clients.

**REQ-SEC-3:** OpenRouter API keys exist only in Edge Function secrets, never in client bundle.

### 4.4 Cross-platform parity

**REQ-XPLAT-1:** Auth bootstrap shall always resolve `isLoading` to false, even if `getSession()` fails.

**REQ-XPLAT-2:** No async `getSession()` calls inside Supabase `onAuthStateChange` callbacks (deadlock prevention on web).

**REQ-XPLAT-3:** Edge Functions expose `Access-Control-Allow-Origin: *` and allow required Supabase client headers on `OPTIONS` and `POST`.

---

# Part II — Software Architecture Document (SAD)

## 1. Architectural overview

SOMMA follows an **Offline-First, Encyclopedia-Driven, AI-Orchestrated** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (Expo — iOS / Android / Web)                        │
│  Expo Router · NativeWind · Zustand · AsyncStorage          │
│  Platform adapters: SecureStore (native) / localStorage(web)│
└───────────────┬─────────────────────────────┬───────────────┘
                │ Supabase JS (JWT)           │ Offline queue
                ▼                             ▼
┌───────────────────────────┐    ┌────────────────────────────┐
│  SUPABASE                 │    │  Local: performanceQueue   │
│  Auth · Postgres · RLS    │    │  currentGameplan · logs    │
│  Edge Functions (Deno)    │    └────────────────────────────┘
└───────────────┬───────────┘
                │ HTTPS + CORS
                ▼
┌───────────────────────────┐
│  OPENROUTER (Llama 3.3)     │
│  Strict JSON in/out         │
└───────────────────────────┘
```

The AI layer is **not** a monolithic workout generator. It is a **protocol orchestrator** that arranges pre-seeded catalog entities under biological and performance constraints.

## 2. Technology stack

| Layer | Technology |
|-------|------------|
| Client | React Native, Expo SDK 54, TypeScript |
| Routing | Expo Router — `(auth)`, `(tabs)`, `(workout)` |
| Styling | NativeWind v4, `darkMode: 'class'`, `global.css` (web) |
| Animation | React Native Reanimated, Gesture Handler |
| State | Zustand + `persist` → AsyncStorage |
| BaaS | Supabase (Postgres, Auth, Edge Functions) |
| LLM | Meta Llama 3.3 via OpenRouter (Edge Function only) |

## 3. The Multiple Experts AI engine

### 3.1 Design principle: Chess Master, not inventor

The LLM **must never hallucinate** exercises, combos, or breath protocols. It only:

1. References `exercise_id` values from `iron_expert.routine_exercise_ids`
2. References `combo_id` values from `combat_expert.allowed_combo_ids`
3. References `tempo_id` values from `spirit_expert.allowed_tempo_ids`

Post-generation **`sanitizeBlueprint()`** drops any ID not in allowlists. Deterministic TypeScript fallback builds a valid day if the LLM fails.

### 3.2 Expert responsibilities

| Expert | Data sources | Behavior |
|--------|--------------|----------|
| **Iron** | `library_exercises`, `performance_logs`, `profiles.weight_kg`, locked routine | **Progressive overload only**—adjust `target_sets`, `target_reps`, `target_weight_kg` per exercise_id; **never** add/remove/reorder routine exercises |
| **Combat** | `library_combat`, `user_stats.combat_mastery` | Shuffle allowed combos into 3–4 rounds; match `complexity_level` to mastery; work/rest seconds typically 180/60 |
| **Spirit / Flow** | Hardcoded tempo catalog + yesterday RPE + `baseline_stress_level` | Prescribe `duration_minutes` and `tempo_id`; high stress → longer recovery breath protocols |

### 3.3 Iron: progressive overload logic

1. Routine exercise IDs are **locked** from yesterday's `daily_protocols.blocks[].iron.exercises` or default push/hinge/pull from catalog.
2. For each `exercise_id`, Edge Function reads latest `performance_logs` entry.
3. Rules (also in system prompt):
   - Prior RPE ≤ 8 → ~+2.5% weight or maintain reps
   - Prior RPE ≥ 9 → deload ~5%
   - No history → estimate from `weight_kg` or null weight for bodyweight
4. Output embedded in `daily_protocols.blocks[].iron`.

### 3.4 Combat: reflex conditioning

1. Filter `library_combat` where `complexity_level <= f(combat_mastery)`.
2. LLM or deterministic shuffle orders combos into rounds with `combo_id`, `work_seconds`, `rest_seconds`.
3. Sequences displayed to user come from DB `sequence` JSON arrays—never LLM-prose combo names.

### 3.5 Biological passport injection

Before LLM call, Edge Function loads `profiles`:

- Compute **age** from `date_of_birth`
- Inject weight, height, body fat, injuries, stress into **system prompt** BIOLOGICAL PASSPORT section
- Instructions: respect injuries (avoid aggravating patterns), reduce volume when stress ≥ 7

### 3.6 Edge Function: `generate_daily_protocol`

| Item | Detail |
|------|--------|
| **Auth** | Requires `Authorization: Bearer <user JWT>` |
| **Input** | `{ focus_preference, available_equipment }` |
| **Output** | `{ date, blocks[], generated_at, source }` |
| **Persistence** | Upsert `daily_protocols` for `protocol_date = today` |
| **CORS** | `OPTIONS` → 204; all responses include ACAO, methods, headers |
| **Secrets** | `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Legacy name in early docs: `generate_next_protocol` — implement as **`generate_daily_protocol`**.

### 3.7 Client sync after workout

`lib/supabase/performance.ts`:

1. Insert `performanceQueue` → `performance_logs`
2. Invoke `generate_daily_protocol`
3. Parse response → update Zustand `currentGameplan`
4. Non-throwing on failure (Ascension still exits to home)

## 4. Cross-platform client architecture

### 4.1 Session & auth adapters

| Platform | Storage | Notes |
|----------|---------|-------|
| iOS / Android | `expo-secure-store` (chunked) | Large JWT support |
| Web | `localStorage` via async adapter | **Bypass SecureStore entirely** |

File: `lib/supabase/client.ts` — `Platform.OS === 'web' ? webStorageAdapter : nativeStorageAdapter`.

### 4.2 Auth provider rules

- Bootstrap: `try/catch/finally` → `isLoading = false` always
- `onAuthStateChange`: synchronous `setSession` only; hydrate profile in deferred `useEffect`
- Deep links: `createSessionFromUrl` deferred with `setTimeout(0)` on web

### 4.3 Routing guards

`FoundationGuard` on `(tabs)/_layout.tsx`: if foundation incomplete → `/(auth)/foundation` or `/(auth)` when configured but logged out.

### 4.4 Zustand model (canonical)

| State | Purpose |
|-------|---------|
| `currentGameplan` | Today's blocks (UI source of truth) |
| `user_biological` | Biological passport mirror |
| `user_environment` | Equipment tags |
| `user_foundation` | Focus + completion timestamp |
| `performance_logs` | Local history |
| `performanceQueue` | Pending Supabase inserts |
| `completeWorkout()` | Queue + sync + recalibrate |
| `resetStore()` | Clear all + AsyncStorage persist |

## 5. Database schema (PostgreSQL)

Migrations in `supabase/migrations/`; seed in `supabase/seed.sql`.

### 5.1 `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users` |
| `name` | text | optional |
| `focus_preference` | jsonb | `{ iron, combat, flow, spirit }` % |
| `date_of_birth` | date | **Biological Passport** |
| `weight_kg` | numeric | **Biological Passport** |
| `height_cm` | numeric | **Biological Passport** |
| `body_fat_percentage` | numeric | nullable |
| `current_injuries` | text | nullable; **AI injury constraints** |
| `baseline_stress_level` | int | 1–10; **AI volume modifier** |
| `created_at` | timestamptz | |

### 5.2 `user_environment`

| Column | Type |
|--------|------|
| `user_id` | uuid PK → profiles |
| `available_equipment` | text[] / jsonb |
| `updated_at` | timestamptz |

### 5.3 `user_stats`

| Column | Type |
|--------|------|
| `user_id` | uuid PK |
| `body_essence`, `mind_essence`, `spirit_essence`, `combat_mastery` | int |

### 5.4 `daily_protocols`

| Column | Type |
|--------|------|
| `user_id`, `protocol_date` | unique |
| `blocks` | jsonb — see §5.7 block shape |
| `source` | text — `ai`, `deterministic`, `fallback`, `stub` |
| `generated_at` | timestamptz |

### 5.5 `performance_logs`

| Column | Type |
|--------|------|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `pillar` | text — iron, combat, flow, spirit |
| `exercise_id` | uuid FK → `library_exercises` (nullable) |
| `block_id` | text |
| `weight_used`, `reps_completed`, `volume` | numeric |
| `rpe_score` | int 1–10 |
| `actual_rest_seconds` | int |
| `payload` | jsonb |
| `timestamp` | timestamptz |

### 5.6 Encyclopedia (read-only, seeded)

**`library_exercises`** (Iron — Elite Hypertrophy encyclopedia, migration `008`):

- `slug`, `name`, `biomechanical_instructions` (jsonb), `equipment_required` (text[]), `default_sets`, `default_reps`, `movement_pattern`
- `primary_muscle` (text), `synergist_muscles` (text[]), `cns_fatigue_cost` (int 1–5), `joint_stress_profile` (text), `stretch_mediated_hypertrophy` (boolean)

**Seed:** `supabase/seed_hypertrophy.sql` (49 curated movements; run after `008_iron_biomechanics.sql`).

**`library_combat`**:

- `slug`, `combo_name`, `sequence` (jsonb array of strike names), `complexity_level` (1–10)

**`library_flow_spirit`** (Flow / Spirit sessions):

- `slug`, `pillar` (`flow` | `spirit`), `session_name`, `description`, `duration_minutes`, `tempo_profile` (jsonb), `complexity_level`

**Seed target:** ≥15 exercises (`seed.sql`), ≥49 hypertrophy exercises (`seed_hypertrophy.sql`), ≥10 combos, ≥5 flow/spirit sessions.

### 5.7 Gameplan block JSON shape (stored in `daily_protocols.blocks`)

```json
{
  "id": "block-main-iron",
  "pillar": "iron",
  "title": "Main Ritual: Iron",
  "subtitle": "Barbell Bench Press · …",
  "duration_minutes": 45,
  "order": 1,
  "status": "pending",
  "iron": {
    "routine_id": "iron_routine_a",
    "exercises": [
      {
        "exercise_id": "uuid-from-library_exercises",
        "target_sets": 4,
        "target_reps": 8,
        "target_weight_kg": 72.5,
        "progression_note": "Progressive overload — prior RPE ≤ 8"
      }
    ]
  },
  "combat": {
    "rounds": [
      { "round_index": 1, "combo_id": "uuid", "work_seconds": 180, "rest_seconds": 60 }
    ]
  },
  "spirit": {
    "mode": "breathwork",
    "tempo_id": "tempo_478",
    "duration_minutes": 18,
    "prescribed_reason": "Recovery — prior main RPE 9"
  }
}
```

Workout players **shall** resolve IDs against library tables (implementation roadmap Day 2).

### 5.8 Planned tables (not yet migrated)

- `user_rituals`, `biomarkers`, `user_exams`, `user_achievements`, Supabase Storage buckets

## 6. API & communication

### 6.1 Client → Supabase

- `@supabase/supabase-js` with user JWT on all user-scoped tables
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_SUPABASE_KEY`)

### 6.2 Edge Functions → OpenRouter

- Strict `response_format: json_object`
- Temperature ~0.2 for deterministic arrangement
- Parse failures → deterministic fallback blocks

### 6.3 CORS policy (web mandate)

Every Edge Function response must include:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers`: `authorization`, `x-client-info`, `apikey`, `content-type`, `x-supabase-api-version`, `prefer`
- `Access-Control-Allow-Methods`: `POST, OPTIONS`
- Preflight `OPTIONS` returns **204** with headers, empty body

---

# Part III — Functional Specification Document (FSD)

## 1. Introduction

This section specifies navigation flows, screen behavior, and Zustand interactions for the **Expo cross-platform** client. Visual design adheres strictly to **Quiet Luxury** (§SRS 4.1).

## 2. Navigation architecture (Expo Router)

```text
app/
├── _layout.tsx                 # Fonts, AuthProvider, SplashGate
├── (auth)/
│   ├── index.tsx               # Welcome & auth
│   └── foundation.tsx            # 3-step Foundation Scan
├── (tabs)/
│   ├── _layout.tsx             # Tabs + FoundationGuard
│   ├── home.tsx                # Daily Command
│   ├── mastery.tsx             # Constellation (placeholder)
│   └── analytics.tsx           # Passport & session controls
└── (workout)/
    ├── iron.tsx
    ├── combat.tsx
    ├── spirit.tsx
    └── ascension.tsx           # gestureEnabled: false
```

## 3. Screen specifications

### 3.1 Flow: Awakening (auth)

#### Welcome & Auth — `/(auth)/index`

| Aspect | Spec |
|--------|------|
| **Visual** | Obsidian background; Playfair hero; glass auth tiles |
| **Auth** | Email OTP, Google OAuth (Supabase); web uses redirect / hash session |
| **Routing** | Session + complete foundation → `/(tabs)/home`; else foundation |

#### Foundation Scan — `/(auth)/foundation`

| Step | UI | Data |
|------|-----|------|
| **I — Attunement** | Selection tiles, gold active state | `focus_preference` |
| **II — Biological Passport** | DOB field, weight/height steppers, optional fat % & injuries, stress 1–10 | `profiles` biological columns |
| **III — Environment** | Multi-select equipment tiles | `user_environment` |
| **Complete** | "Enter Sanctuary" CTA | Zustand + Supabase sync + `fetchDailyGameplanAsync` |

Progress indicator: `FoundationProgress` (3 segments).

### 3.2 Flow: Sanctuary (tabs)

#### Daily Command — `/(tabs)/home`

| Aspect | Spec |
|--------|------|
| **Background** | `#0F1512` |
| **Header** | "The Sanctuary" / "Daily Command" |
| **Attunement** | Placeholder orb panel (future: live stats) |
| **Blocks** | `GameplanBlockCard` — glass (`bg-white/5`), pillar accent typography |
| **Empty** | Pressable card → Foundation Scan |
| **Recalibrate** | Invokes Edge Function |
| **State** | `currentGameplan`, `gameplan_loading`, `performance_syncing` |

#### Analytics — `/(tabs)/analytics`

- Sign out → `resetStore()` → `/(auth)`
- Reset profile → sign out + clear → `/(auth)`
- Reset local foundation → `resetStore()` → `/(auth)/foundation`
- Future: edit biological passport, biomarker charts

#### Mastery — `/(tabs)/mastery`

- Placeholder copy; "Preview map" shows Incoming alert until constellation ships

### 3.3 Flow: Execution (workout)

#### Iron — `/(workout)/iron`

| Aspect | Spec |
|--------|------|
| **Data target** | `block.iron.exercises[]` + `library_exercises` |
| **UI** | Exercise name, biomechanical cues, weight/rep steppers, set log, rest overlay |
| **Adapt** | Swap within library; alert if no alternate |
| **Complete** | `finishBlock` → Ascension with pillar + volume meta |

*Current MVP may still use local `iron-exercises.ts` until Day 2 wiring.*

#### Combat — `/(workout)/combat`

| Aspect | Spec |
|--------|------|
| **Data target** | `block.combat.rounds[]` + `library_combat.sequence` |
| **UI** | Combo display, round timer, pause/reset, RPE selector |
| **Theme** | Copper / blood accents per Quiet Luxury combat variant |

#### Spirit — `/(workout)/spirit`

| Aspect | Spec |
|--------|------|
| **UI** | Dim obsidian; BreathOrbVisualizer; tempo selector |
| **Data target** | `block.spirit` or `library_flow_spirit` |

#### Ascension Flare — `/(workout)/ascension`

| Aspect | Spec |
|--------|------|
| **Duration** | 3 seconds minimum before navigation |
| **Visual** | Full-screen Obsidian; **subtle** gold radial glow (low opacity); centered status copy |
| **Forbidden** | Full-screen matte-gold flash; horizontal "loading bars"; blocking uncaught promise rejections |
| **Logic** | `completeWorkout` in try/catch; `setTimeout(3000)` → `router.replace('/(tabs)/home')` **always** |
| **Input** | Route params from `finishBlock`: blockId, pillar, rpe, volume, etc. |

### 3.4 Global UX safeguards

| Guard | Implementation |
|-------|----------------|
| Foundation incomplete on tabs | `FoundationGuard` |
| Auth loading hang | `AuthProvider` finally block |
| Splash stuck | `SplashGate` hides after fonts + auth ready |
| Dead buttons | `alertIncomingFeature()` for unfinished actions |

## 4. State & sync (Zustand)

| Action | Effect |
|--------|--------|
| `completeFoundationScan` | Sets foundation, biological, environment, stats, stub gameplan |
| `fetchDailyGameplanAsync` | Edge/cache/stub path |
| `completeWorkout` | Queue → Supabase → recalibrate gameplan |
| `resetStore` | Full wipe + clear AsyncStorage |

Persist key: `somma-offline-store`.

## 5. Acceptance criteria (MVP+)

1. User completes 3-step Foundation on web **and** mobile without auth deadlock.
2. `seed.sql` populates libraries; Recalibrate returns blocks with valid catalog IDs.
3. Workout completion always returns to Home in 3s even if `performance_logs` or Edge Function fails.
4. No hallucinated exercise names in Edge output after `sanitizeBlueprint`.
5. Biological fields visible in Supabase `profiles` and reflected in Edge Function logs/prompt.
6. Web Recalibrate succeeds without CORS errors (post-deploy).

---

## Document history

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | Initial | Monolithic AI, mobile-only assumptions |
| 2.0 | May 2026 | Cross-platform mandate, Multiple Experts, Biological Passport, Quiet Luxury enforcement, Ascension graceful exit |

**Implementation status:** See `CONTEXT_ANCHOR_V5.md`.  
**SQL apply order:** `001` → `006`, then `seed.sql`.  
**Deploy:** `supabase functions deploy generate_daily_protocol`.
