import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body: string | null, status: number, extraHeaders?: Record<string, string>) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return corsResponse(JSON.stringify(body), status, {
    'Content-Type': 'application/json',
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FocusPreference {
  iron: number;
  combat: number;
  flow: number;
  spirit: number;
}

interface BiologicalPassport {
  age_years: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  current_injuries: string | null;
  baseline_stress_level: number | null;
}

interface ProfileRow {
  focus_preference: FocusPreference | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  current_injuries: string | null;
  baseline_stress_level: number | null;
}

interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  equipment_required: string[];
  default_sets: number;
  default_reps: number;
  movement_pattern: string | null;
  primary_muscle?: string | null;
  synergist_muscles?: string[];
  cns_fatigue_cost?: number | null;
  joint_stress_profile?: string | null;
  stretch_mediated_hypertrophy?: boolean;
}

type CombatTacticalFocus =
  | 'footwork_range'
  | 'power_inside'
  | 'defense_counter'
  | 'burnout';

const COMBAT_TACTICAL_FOCUS_VALUES: CombatTacticalFocus[] = [
  'footwork_range',
  'power_inside',
  'defense_counter',
  'burnout',
];

interface LibraryCombo {
  id: string;
  slug: string;
  combo_name: string;
  sequence: string[];
  complexity_level: number;
  tactical_focus: CombatTacticalFocus;
}

interface CombatRoundStructureEntry {
  round_start: number;
  round_end: number;
  tactical_focus: CombatTacticalFocus;
  coach_intent?: string;
}

interface SpiritTempo {
  id: string;
  name: string;
  inhale_seconds: number;
  hold_seconds: number;
  exhale_seconds: number;
  hold_empty_seconds: number;
}

interface PerformanceLogRow {
  pillar: string;
  exercise_id: string | null;
  weight_used: number | null;
  reps_completed: number | null;
  rpe_score: number | null;
  timestamp: string;
  payload?: {
    iron?: { exercise_id?: string; sets?: unknown[] };
    combat?: { rounds?: unknown[]; volume?: number };
  } | null;
}

type IronExecutionTechnique =
  | 'Standard'
  | 'Myo-Reps'
  | 'Rest-Pause'
  | 'Slow Eccentric (4s)'
  | 'Drop Set'
  | 'Cluster Sets';

interface IronExercisePrescription {
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_rep_range: string;
  target_rir: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  alternative_exercise_id: string | null;
  progression_note: string;
  execution_technique: IronExecutionTechnique;
}

interface WeeklyMuscleVolumeRow {
  primary_muscle: string;
  working_sets_7d: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'at_mrv';
  mev_target: number;
  mrv_soft: number;
  mrv_hard: number;
}

interface MesocycleExerciseSummary {
  exercise_id: string;
  exercise_name: string;
  sessions_logged: number;
  last_weight_kg: number | null;
  last_reps: number | null;
  last_rpe: number | null;
  avg_rpe_3w: number | null;
  progression_recommendation: 'load' | 'volume' | 'deload' | 'maintain';
  notes: string;
}

interface IronAutoregulationState {
  high_stress_mode: boolean;
  poor_recovery: boolean;
  baseline_stress_level: number | null;
  current_injuries: string | null;
  blocked_joint_profiles: string[];
  swaps_applied: { from_exercise_id: string; to_exercise_id: string; reason: string }[];
}

interface IronCatalogEntry {
  id: string;
  slug: string;
  name: string;
  primary_muscle: string | null;
  synergist_muscles: string[];
  cns_fatigue_cost: number | null;
  joint_stress_profile: string | null;
  stretch_mediated_hypertrophy: boolean;
  movement_pattern: string | null;
  default_sets: number;
  default_reps: number;
  equipment_required: string[];
}

const MESOCYCLE_DAYS = 21;
const WEEKLY_VOLUME_DAYS = 7;
const HYPERTROPHY_MEV_SETS = 10;
const HYPERTROPHY_MRV_SOFT = 18;
const HYPERTROPHY_MRV_HARD = 20;
const HIGH_CNS_SWAP_THRESHOLD = 4;
const LOW_CNS_SWAP_MAX = 2;
const VALID_EXECUTION_TECHNIQUES: IronExecutionTechnique[] = [
  'Standard',
  'Myo-Reps',
  'Rest-Pause',
  'Slow Eccentric (4s)',
  'Drop Set',
  'Cluster Sets',
];

interface CombatRoundPrescription {
  round_index: number;
  combo_id: string;
  work_seconds: number;
  rest_seconds: number;
  tactical_focus: CombatTacticalFocus;
}

interface FlowAsanaPrescription {
  asana_id: string;
  slug: string;
  name: string;
  order: number;
  hold_seconds: number;
  target_recovery_zones: string[];
  is_dynamic_flow: boolean;
}

interface SpiritPrescription {
  mode: 'flow' | 'breathwork';
  tempo_id?: string;
  duration_minutes: number;
  prescribed_reason: string;
  recovery_focus_zones?: string[];
  asanas?: FlowAsanaPrescription[];
}

interface LibraryFlowSpiritRow {
  id: string;
  slug: string;
  pillar: 'flow' | 'spirit';
  session_name: string;
  description: string | null;
  duration_minutes: number;
  tempo_profile: Record<string, unknown>;
  complexity_level: number;
  target_recovery_zones: string[];
  complexity_tier: number;
  is_dynamic_flow: boolean;
  default_hold_seconds: number;
}

interface HealerRecoveryState {
  window_hours: number;
  logs_analyzed: number;
  spirit_essence: number;
  max_complexity_tier: number;
  required_recovery_zones: string[];
  iron_lower_body_heavy: boolean;
  combat_load_high: boolean;
  prescribed_reason: string;
}

const HEALER_WINDOW_HOURS = 48;
const SPIRIT_BEGINNER_ESSENCE_MAX = 33;

const LOWER_BODY_RECOVERY_ZONES = ['lower_back', 'hips'] as const;
const LOWER_BODY_MUSCLES = new Set([
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'hip_flexors',
]);
const LOWER_BODY_PATTERNS = new Set(['squat', 'hinge', 'lunge']);
const LOWER_BODY_SLUG_HINTS = [
  'squat',
  'deadlift',
  'rdl',
  'lunge',
  'leg_press',
  'hack',
  'hip_thrust',
  'split_squat',
  'bss',
  'good_morning',
  'leg_curl',
  'calf',
];

interface GameplanBlockPayload {
  id: string;
  pillar: 'iron' | 'combat' | 'spirit';
  title: string;
  subtitle: string;
  duration_minutes: number;
  order: number;
  iron?: {
    routine_id: string;
    exercises: IronExercisePrescription[];
  };
  combat?: {
    rounds_structure: CombatRoundStructureEntry[];
    rounds: CombatRoundPrescription[];
  };
  spirit?: SpiritPrescription;
}

interface AiBlueprintResponse {
  blocks?: GameplanBlockPayload[];
  error?: string;
  message?: string;
}

interface MandatoryCatalogAssets {
  available_equipment: string[];
  exercises_all: LibraryExercise[];
  exercises: LibraryExercise[];
  combat: LibraryCombo[];
  flow_spirit: LibraryFlowSpiritRow[];
  spirit_tempo_ids: string[];
  fetch_errors: string[];
}

/** Fixed breathwork tempos — not LLM-invented */
const SPIRIT_TEMPO_CATALOG: SpiritTempo[] = [
  {
    id: 'tempo_478',
    name: '4-7-8 Recovery',
    inhale_seconds: 4,
    hold_seconds: 7,
    exhale_seconds: 8,
    hold_empty_seconds: 0,
  },
  {
    id: 'tempo_box',
    name: 'Box Breathing',
    inhale_seconds: 4,
    hold_seconds: 4,
    exhale_seconds: 4,
    hold_empty_seconds: 4,
  },
  {
    id: 'tempo_relax',
    name: 'Relaxing Exhale',
    inhale_seconds: 4,
    hold_seconds: 0,
    exhale_seconds: 6,
    hold_empty_seconds: 0,
  },
];

const FALLBACK_BLOCKS: GameplanBlockPayload[] = [
  {
    id: 'block-morning-flow',
    pillar: 'spirit',
    title: 'Morning Flow',
    subtitle: 'Box breathing · 18 min · catalog tempo',
    duration_minutes: 18,
    order: 0,
    spirit: {
      mode: 'breathwork',
      tempo_id: 'tempo_box',
      duration_minutes: 18,
      prescribed_reason: 'Fallback — no AI key or validation failure',
    },
  },
  {
    id: 'block-main-iron',
    pillar: 'iron',
    title: 'Main Ritual: Iron',
    subtitle: 'Strength · 40 min · baseline load',
    duration_minutes: 40,
    order: 1,
  },
];

// ---------------------------------------------------------------------------
// System prompt — Multiple Experts (Chess Master over fixed catalogs)
// ---------------------------------------------------------------------------

function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function mapBiologicalPassport(profile: ProfileRow | null): BiologicalPassport {
  return {
    age_years: ageFromDateOfBirth(profile?.date_of_birth ?? null),
    weight_kg: profile?.weight_kg != null ? Number(profile.weight_kg) : null,
    height_cm: profile?.height_cm != null ? Number(profile.height_cm) : null,
    body_fat_percentage:
      profile?.body_fat_percentage != null ? Number(profile.body_fat_percentage) : null,
    current_injuries: profile?.current_injuries ?? null,
    baseline_stress_level:
      profile?.baseline_stress_level != null ? Number(profile.baseline_stress_level) : null,
  };
}

const SPIRIT_SLUG_TO_TEMPO_ID: Record<string, string> = {
  recovery_478: 'tempo_478',
  tempo_box_breathwork: 'tempo_box',
  relaxing_exhale: 'tempo_relax',
  nsdr_body_scan: 'tempo_nsdr',
};

function buildSystemPrompt(biological: BiologicalPassport, availableAssetsTag: string): string {
  const injuryRule = biological.current_injuries?.trim()
    ? `ACTIVE INJURY CONSTRAINTS (mandatory): "${biological.current_injuries.trim()}". The server has already removed conflicting joint_stress_profile tags from the routine; you must NOT prescribe any exercise_id not in iron_expert.routine_exercise_ids.`
    : 'No active injuries reported — still use RIR and conservative technique selection.';

  const stressRule =
    biological.baseline_stress_level != null && biological.baseline_stress_level >= 7
      ? 'HIGH STRESS (7–10): iron_expert.autoregulation.high_stress_mode is true. CNS-heavy swaps may already be applied. Prefer execution_technique "Standard" or "Slow Eccentric (4s)", avoid Rest-Pause/Myo-Reps unless mesocycle says load progression with low RPE history.'
      : biological.baseline_stress_level != null && biological.baseline_stress_level <= 3
        ? 'Low baseline stress (1–3): full progressive overload allowed when mesocycle supports it.'
        : 'Moderate baseline stress: standard hypertrophy dosing.';

  const weightRule =
    biological.weight_kg != null
      ? `Reference body mass: ${biological.weight_kg} kg. Estimate conservative target_weight_kg only when mesocycle has no logs for that exercise_id.`
      : 'Body mass unknown — leave target_weight_kg null when no performance history.';

  const ageRule =
    biological.age_years != null
      ? `Athlete age: ${biological.age_years} years. Older athletes: bias 2–3 RIR, avoid Cluster Sets unless mesocycle load progression is clear.`
      : 'Age unknown — default to 2 RIR and Standard technique.';

  return `You are the Head Coach of the SOMMA Longevity Clinic. You must assemble a daily protocol by orchestrating three specialized coaches. Follow these steps strictly internally before outputting the JSON:

STEP 1 (Head Coach): Analyze the user's Biological Passport (weight, stress, injuries) and the recent \`performance_logs\`. Determine the global fatigue level.
STEP 2 (Iron Coach): Select a logical sequence of exercises from <AVAILABLE_ASSETS> based on Step 1. Apply progressive overload.
STEP 3 (Combat Coach): Look at the Iron Coach's selection. If Iron heavily taxed the legs, the Combat sequence MUST focus on Boxing (upper body/head movement). If Iron taxed the upper body, Combat MUST focus on Muay Thai kicks and knees.
STEP 4 (Flow/Spirit Coach): Look at Steps 2 and 3. Select recovery poses from <AVAILABLE_ASSETS> that directly decompress the targeted muscles.

Constraint: The output MUST be a valid JSON containing the full arrays for \`exercises\`, \`rounds\`, and \`sequence\` representing the complete workout, not just a single item.

You are FORBIDDEN from suggesting any exercise or movement NOT present in the <AVAILABLE_ASSETS> list. If you do not have enough data, return a structured error JSON object {"error":"INSUFFICIENT_CATALOG","message":"..."} — do NOT invent movements.

${availableAssetsTag}

BIOLOGICAL PASSPORT (authoritative — used in STEP 1):
- ${ageRule}
- ${weightRule}
- Height cm: ${biological.height_cm ?? 'unknown'}
- Body fat %: ${biological.body_fat_percentage ?? 'unknown'}
- Baseline stress (1–10): ${biological.baseline_stress_level ?? 'unknown'}
- ${stressRule}
- ${injuryRule}

GLOBAL LAWS (violation = invalid response):
1. <AVAILABLE_ASSETS> is the authoritative movement catalog — every exercise_id, combo_id, asana_id, and tempo_id MUST exist in that list. expert_context narrows choices but NEVER adds IDs.
2. Every exercise_id MUST appear in iron_expert.routine_exercise_ids AND in <AVAILABLE_ASSETS>.exercises. Every combo_id in combat_expert.allowed_combo_ids AND in <AVAILABLE_ASSETS>.combat. Flow asanas from <AVAILABLE_ASSETS>.flow only. Breathwork tempo_id from <AVAILABLE_ASSETS>.spirit_breathwork only.
3. NEVER output exercise names or combo names as identifiers — IDs only in prescription fields.
4. Iron block MUST include exactly one entry per id in iron_expert.routine_exercise_ids, same order. Do NOT add/remove/reorder iron exercises.
5. Use iron_expert.catalog_dictionary for primary_muscle, cns_fatigue_cost, joint_stress_profile — scientific decisions only from this data.
6. Return ONLY valid JSON. No markdown. If catalogs cannot support a block, return {"error":"INSUFFICIENT_CATALOG","message":"..."} instead of blocks.

OUTPUT SCHEMA:
{
  "blocks": [
    {
      "id": "string",
      "pillar": "iron" | "combat" | "spirit",
      "title": "string",
      "subtitle": "string",
      "duration_minutes": number,
      "order": number,
      "iron": {
        "routine_id": "string",
        "exercises": [
          {
            "exercise_id": "uuid (iron_expert.routine_exercise_ids only)",
            "target_sets": number,
            "target_reps": number,
            "target_rep_range": "string e.g. 8-10 @ 2 RIR",
            "target_rir": number,
            "target_weight_kg": number | null,
            "rest_seconds": number,
            "alternative_exercise_id": "uuid | null (catalog; same primary_muscle; cns <= current)",
            "progression_note": "string",
            "execution_technique": "Standard" | "Myo-Reps" | "Rest-Pause" | "Slow Eccentric (4s)" | "Drop Set" | "Cluster Sets"
          }
        ]
      },
      "combat": {
        "rounds_structure": [{
          "round_start": number,
          "round_end": number,
          "tactical_focus": "footwork_range" | "power_inside" | "defense_counter" | "burnout",
          "coach_intent": "string (short coaching note for this segment)"
        }],
        "rounds": [{
          "round_index": number,
          "combo_id": "uuid (combat_expert.allowed_combo_ids only)",
          "work_seconds": number,
          "rest_seconds": number,
          "tactical_focus": "footwork_range" | "power_inside" | "defense_counter" | "burnout"
        }]
      },
      "spirit": {
        "mode": "flow" | "breathwork",
        "tempo_id": "string (breathwork only — spirit_expert.allowed_tempo_ids)",
        "duration_minutes": number,
        "prescribed_reason": "string",
        "recovery_focus_zones": ["lower_back", "hips", ...],
        "asanas": [{
          "asana_id": "uuid (flow catalog only)",
          "order": number,
          "hold_seconds": number
        }]
      }
    }
  ]
}

STEP 2 DETAIL — IRON COACH (Elite Hypertrophy / Bodybuilding Coach):

MESOCYCLE (21-day window — iron_expert.mesocycle):
- Read iron_expert.performance_history_3w and iron_expert.mesocycle.per_exercise summaries.
- If athlete hit prescribed reps with RPE ≤ 8 across recent sessions for an exercise_id → MUST progress: +2.5% load OR +1 rep on the top of the rep range (state which in progression_note).
- If RPE ≥ 9 or failed rep targets → deload ~5% load OR reduce target_rir to 3–4, sets −1.
- If no logs in 3 weeks → use catalog defaults with target_rep_range "8-12 @ 2 RIR" and estimate load from body mass.

RIR (Reps in Reserve) — mandatory:
- Always set target_rep_range as a STRING like "8-10 @ 2 RIR" or "12-15 @ 1 RIR".
- Set target_reps to the TOP of the rep range (integer) for logging compatibility.
- Set target_rir (0–4) matching the prescription. Default hypertrophy: 2 RIR unless deloading (3–4 RIR).

FATIGUE & STRESS AUTOREGULATION:
- If iron_expert.autoregulation.high_stress_mode OR poor_recovery: reduce target_sets by 1 on compounds, keep accessories; never prescribe execution_technique "Rest-Pause" or "Cluster Sets" on CNS cost ≥ 4 slots.
- Server may have swapped high cns_fatigue_cost movements for lower-cost same primary_muscle — see autoregulation.swaps_applied. Honor those exercise_ids.
- NEVER prescribe an exercise whose joint_stress_profile is in autoregulation.blocked_joint_profiles.

EXECUTION TECHNIQUE (execution_technique field):
- "Standard" — default working sets.
- "Myo-Reps" — only on isolation (cns ≤ 2) when chasing volume with low systemic fatigue.
- "Rest-Pause" — only when stress low and mesocycle recommends load progression with good recovery.
- "Slow Eccentric (4s)" — deload weeks, high stress, or stretch_mediated_hypertrophy bias.
- "Drop Set" / "Cluster Sets" — advanced; max one exercise per iron block, stress ≤ 6 only.

BIOMECHANICS (iron_expert.catalog_dictionary):
- Match progression to primary_muscle; avoid redundant synergist overlap in notes.
- Prefer stretch_mediated_hypertrophy exercises at 2 RIR when joints allow.

DYNAMIC REST (rest_seconds — mandatory per exercise):
- Set from cns_fatigue_cost: CNS 1–2 → 60–90s (use 60–75), CNS 3 → ~105s, CNS 4–5 → 120–180s (use 150–180).
- Never prescribe rest below 60 or above 180.

WEEKLY VOLUME (MEV/MRV — iron_expert.weekly_volume_7d):
- working_sets_7d = direct working sets per primary_muscle in last 7 days (server-calculated).
- Optimal hypertrophy band: 10–20 sets/muscle/week (MEV≈10, MRV soft≈18, hard cap 20).
- If a muscle is below_mev → you may hold or add 1 set today if recovery allows.
- If approaching_mrv or at_mrv AND (high_stress_mode OR poor_recovery) → MUST cut target_sets today (typically −1 to −2 sets) and note in progression_note.
- If at_mrv even with low stress → do not add sets; maintain or reduce.

SMART SUBSTITUTION (alternative_exercise_id — mandatory when possible):
- For each exercise_id, set alternative_exercise_id to a different catalog UUID with the SAME primary_muscle and cns_fatigue_cost ≤ current (lower preferred).
- Must be in allowed_exercise_ids, not blocked by injuries, equipment-available.
- Use null only if no valid alternative exists.

STEP 3 DETAIL — COMBAT COACH (Blood & Bone — Elite Striking Coach):
- Cross-pillar rule from Head Coach: inspect the Iron block's exercises[] you built in STEP 2. Identify the primary muscle groups taxed (lower_body: quads/hamstrings/glutes/calves; upper_body: chest/back/shoulders/biceps/triceps). Then:
  * Iron taxed lower body heavily → ENTIRE Combat sequence MUST be Boxing-dominant (jabs, crosses, hooks, uppercuts, slips, head movement, footwork). Avoid roundhouses, teeps, knees, low kicks.
  * Iron taxed upper body heavily → ENTIRE Combat sequence MUST be Muay Thai-dominant (teeps, roundhouse kicks, knees, push kicks, leg kicks). Minimize punching volume on the arms.
  * Mixed or no Iron session → standard tactical arc at coach's discretion.
- You prescribe TACTICAL ROUNDS, not generic pad work. Use combat_expert.tactical_focus_catalog.
- REQUIRED: combat.rounds_structure — narrative arc (2–4 segments). Example:
  * Round 1 only: footwork_range (establish range, teeps, angles, exits)
  * Rounds 2–3: power_inside (hooks, body shots, clinch entries, knees/elbows)
  * Round 4: defense_counter OR burnout depending on yesterday_main_rpe / stress
- Each rounds_structure entry: round_start, round_end (1-based inclusive), tactical_focus, coach_intent (1 sentence).
- combat.rounds: one entry per round_index (0-based); each MUST include tactical_focus matching its segment in rounds_structure.
- combo_id ONLY from combat_expert.allowed_combo_ids. Prefer combos whose catalog tactical_focus matches the round's tactical_focus (see catalog_by_tactical_focus).
- Sequences include defensive cues (Slip Left/Right, Roll Right, Check Kick, Parry, Sprawl, High Guard) — honor them in coach_intent.
- Match complexity to combat_mastery; never above max_complexity_for_user.
- work_seconds: footwork_range/defense_counter 180; power_inside 180; burnout 120–150 with rest_seconds 45–60.
- High stress or yesterday_main_rpe >= 8: shorten burnout, add defense_counter segment, reduce round count to 3.

STEP 4 DETAIL — FLOW / SPIRIT COACH (Biomechanical Healer):
- Cross-pillar rule from Head Coach: inspect the muscle groups taxed in STEPS 2 AND 3. Select asanas that directly decompress those muscles. Examples:
  * Heavy lower body Iron + Boxing Combat → prioritize hip flexors, quads, hamstrings, lumbar (e.g. pigeon, low lunge, supine twist, forward fold).
  * Heavy upper body Iron + Muay Thai Combat → prioritize chest, shoulders, lats, hip flexors from kicks (e.g. doorframe stretch analog, thread the needle, low lunge).
  * Document this reasoning in prescribed_reason.
- Read spirit_expert.healer_48h — REQUIRED for Flow prescriptions (mode: "flow").
- MANDATORY: If healer_48h.iron_lower_body_heavy is true, EVERY asana_id MUST come from flow entries whose target_recovery_zones includes "lower_back" OR "hips" (see flow_catalog_by_zone).
- MANDATORY: If spirit_essence is low (spirit_expert.spirit_essence <= ${SPIRIT_BEGINNER_ESSENCE_MAX}), only prescribe asanas with complexity_tier 1 (spirit_expert.max_complexity_tier).
- Flow block: mode "flow", asanas[] (4–7 items) with asana_id from spirit_expert.allowed_flow_ids only; hold_seconds per asana (use catalog default_hold_seconds; dynamic flows ~30s equivalent).
- recovery_focus_zones MUST echo healer_48h.required_recovery_zones.
- Breathwork block: mode "breathwork", tempo_id from allowed_tempo_ids when nervous-system downregulation is priority (high RPE / stress).
- Use yesterday_main_rpe: RPE >= 8 favors longer flow (18–22 min) or breathwork tempo_478; RPE <= 4 shorter primer (10–14 min).
- prescribed_reason must cite 48h load and the specific muscles taxed by Iron + Combat (e.g. "Hip & lumbar restore — heavy hinge + boxing volume in 48h").

DAY STRUCTURE:
- 2–4 blocks, order starting at 0.
- Balance pillars using focus_preference weights (highest weight = main ritual block).
- Include at most one iron block, one combat block; spirit/flow blocks use pillar "spirit".`;
}

// ---------------------------------------------------------------------------
// Iron — Elite Hypertrophy coaching engine
// ---------------------------------------------------------------------------

const LIBRARY_EXERCISE_SELECT =
  'id, slug, name, equipment_required, default_sets, default_reps, movement_pattern, primary_muscle, synergist_muscles, cns_fatigue_cost, joint_stress_profile, stretch_mediated_hypertrophy, biomechanical_instructions';

function mapLibraryExerciseRow(row: Record<string, unknown>): LibraryExercise {
  const synergists = Array.isArray(row.synergist_muscles)
    ? row.synergist_muscles.map(String)
    : [];
  const cnsRaw = row.cns_fatigue_cost;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    equipment_required: Array.isArray(row.equipment_required)
      ? row.equipment_required.map(String)
      : [],
    default_sets: typeof row.default_sets === 'number' ? row.default_sets : 4,
    default_reps: typeof row.default_reps === 'number' ? row.default_reps : 8,
    movement_pattern:
      typeof row.movement_pattern === 'string' ? row.movement_pattern : null,
    primary_muscle:
      typeof row.primary_muscle === 'string' ? row.primary_muscle : null,
    synergist_muscles: synergists,
    cns_fatigue_cost:
      typeof cnsRaw === 'number' && cnsRaw >= 1 && cnsRaw <= 5 ? cnsRaw : null,
    joint_stress_profile:
      typeof row.joint_stress_profile === 'string' ? row.joint_stress_profile : null,
    stretch_mediated_hypertrophy: row.stretch_mediated_hypertrophy === true,
  };
}

function toCatalogEntry(row: LibraryExercise): IronCatalogEntry {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    primary_muscle: row.primary_muscle ?? null,
    synergist_muscles: row.synergist_muscles ?? [],
    cns_fatigue_cost: row.cns_fatigue_cost ?? null,
    joint_stress_profile: row.joint_stress_profile ?? null,
    stretch_mediated_hypertrophy: row.stretch_mediated_hypertrophy ?? false,
    movement_pattern: row.movement_pattern,
    default_sets: row.default_sets,
    default_reps: row.default_reps,
    equipment_required: row.equipment_required,
  };
}

function buildCatalogDictionary(catalog: LibraryExercise[]): Record<string, IronCatalogEntry> {
  const dict: Record<string, IronCatalogEntry> = {};
  for (const row of catalog) {
    dict[row.id] = toCatalogEntry(row);
  }
  return dict;
}

function parseBlockedJointProfiles(injuries: string | null): string[] {
  if (!injuries?.trim()) return [];
  const text = injuries.toLowerCase();
  const blocked: string[] = [];

  if (/knee|patella|acl|meniscus/.test(text)) {
    blocked.push('high_knee_shear', 'moderate_knee_stress');
  }
  if (/shoulder|rotator|impingement|labrum/.test(text)) {
    blocked.push('rotator_cuff_heavy', 'shoulder_impingement_risk');
  }
  if (/lumbar|lower back|disc|spine|back/.test(text)) {
    blocked.push('lumbar_shear', 'spinal_axial_load');
  }
  if (/wrist|elbow/.test(text)) {
    blocked.push('wrist_stress');
  }
  if (/neck|cervical/.test(text)) {
    blocked.push('cervical_load');
  }

  return [...new Set(blocked)];
}

function isExerciseBlocked(
  exercise: LibraryExercise,
  blockedProfiles: string[],
): boolean {
  if (!exercise.joint_stress_profile) return false;
  return blockedProfiles.includes(exercise.joint_stress_profile);
}

function filterIronLogsLastDays(logs: PerformanceLogRow[], days: number): PerformanceLogRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();
  return logs
    .filter((log) => log.pillar === 'iron' && log.timestamp >= cutoffIso)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function computeRestSecondsFromCns(cnsFatigueCost: number | null): number {
  const cost = cnsFatigueCost ?? 3;
  if (cost >= 5) return 180;
  if (cost >= 4) return 150;
  if (cost >= 3) return 105;
  if (cost >= 2) return 75;
  return 60;
}

function countWorkingSetsFromIronLog(
  log: PerformanceLogRow,
  catalog: LibraryExercise[],
): { exerciseId: string; sets: number } | null {
  const payloadExerciseId = log.payload?.iron?.exercise_id;
  const exerciseId = payloadExerciseId ?? log.exercise_id;
  if (!exerciseId) return null;

  const setCount = Array.isArray(log.payload?.iron?.sets)
    ? log.payload!.iron!.sets!.length
    : 1;

  return { exerciseId, sets: Math.max(1, setCount) };
}

function buildWeeklyVolumeByMuscle(
  catalog: LibraryExercise[],
  ironLogs7d: PerformanceLogRow[],
): WeeklyMuscleVolumeRow[] {
  const totals = new Map<string, number>();

  for (const log of ironLogs7d) {
    const counted = countWorkingSetsFromIronLog(log, catalog);
    if (!counted) continue;
    const meta = catalog.find((row) => row.id === counted.exerciseId);
    const muscle = meta?.primary_muscle;
    if (!muscle) continue;
    totals.set(muscle, (totals.get(muscle) ?? 0) + counted.sets);
  }

  const muscles = new Set<string>();
  for (const row of catalog) {
    if (row.primary_muscle) muscles.add(row.primary_muscle);
  }
  for (const muscle of totals.keys()) {
    muscles.add(muscle);
  }

  return [...muscles].map((primary_muscle) => {
    const working_sets_7d = totals.get(primary_muscle) ?? 0;
    let status: WeeklyMuscleVolumeRow['status'] = 'optimal';
    if (working_sets_7d >= HYPERTROPHY_MRV_HARD) status = 'at_mrv';
    else if (working_sets_7d >= HYPERTROPHY_MRV_SOFT) status = 'approaching_mrv';
    else if (working_sets_7d < HYPERTROPHY_MEV_SETS) status = 'below_mev';

    return {
      primary_muscle,
      working_sets_7d,
      status,
      mev_target: HYPERTROPHY_MEV_SETS,
      mrv_soft: HYPERTROPHY_MRV_SOFT,
      mrv_hard: HYPERTROPHY_MRV_HARD,
    };
  });
}

function applyWeeklyVolumeSetCap(
  sets: number,
  primaryMuscle: string | null,
  weeklyVolume: WeeklyMuscleVolumeRow[],
  autoreg: IronAutoregulationState,
): { sets: number; volumeNote: string } {
  if (!primaryMuscle) return { sets, volumeNote: '' };

  const row = weeklyVolume.find((item) => item.primary_muscle === primaryMuscle);
  const current = row?.working_sets_7d ?? 0;
  const status = row?.status ?? 'optimal';
  let volumeNote = '';

  if (status === 'below_mev') {
    volumeNote = `Weekly ${primaryMuscle}: ${current}/${HYPERTROPHY_MEV_SETS} sets — below MEV`;
  } else if (status === 'optimal') {
    volumeNote = `Weekly ${primaryMuscle}: ${current} sets — optimal band`;
  }

  if (
    (status === 'approaching_mrv' || status === 'at_mrv') &&
    (autoreg.high_stress_mode || autoreg.poor_recovery)
  ) {
    const reduced = Math.max(2, sets - (status === 'at_mrv' ? 2 : 1));
    volumeNote = `MRV guard — ${primaryMuscle} ${current} sets/7d + stress; −${sets - reduced} sets today`;
    return { sets: reduced, volumeNote };
  }

  if (current + sets > HYPERTROPHY_MRV_HARD) {
    const reduced = Math.max(2, sets - 1);
    volumeNote = `MRV cap — ${primaryMuscle} would exceed ${HYPERTROPHY_MRV_HARD} sets/7d`;
    return { sets: reduced, volumeNote };
  }

  return { sets, volumeNote };
}

function findAlternativeExerciseId(
  exerciseId: string,
  catalog: LibraryExercise[],
  blockedProfiles: string[],
  equipment: string[],
): string | null {
  const current = catalog.find((row) => row.id === exerciseId);
  if (!current?.primary_muscle) return null;

  const currentCns = current.cns_fatigue_cost ?? 5;
  const alternatives = catalog
    .filter(
      (row) =>
        row.id !== exerciseId &&
        row.primary_muscle === current.primary_muscle &&
        (row.cns_fatigue_cost ?? 5) <= currentCns &&
        !isExerciseBlocked(row, blockedProfiles) &&
        equipmentMatches(row, equipment),
    )
    .sort((a, b) => (a.cns_fatigue_cost ?? 5) - (b.cns_fatigue_cost ?? 5));

  const lowerCns = alternatives.find(
    (row) => (row.cns_fatigue_cost ?? 5) < currentCns,
  );
  return (lowerCns ?? alternatives[0])?.id ?? null;
}

function buildMesocycleSummaries(
  routineIds: string[],
  catalog: LibraryExercise[],
  ironLogs3w: PerformanceLogRow[],
): MesocycleExerciseSummary[] {
  return routineIds.map((exerciseId) => {
    const meta = catalog.find((row) => row.id === exerciseId);
    const logs = ironLogs3w.filter((log) => log.exercise_id === exerciseId);
    const last = logs[0];
    const rpeValues = logs
      .map((log) => log.rpe_score)
      .filter((rpe): rpe is number => rpe != null);
    const avgRpe =
      rpeValues.length > 0
        ? Math.round((rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length) * 10) / 10
        : null;

    let progression: MesocycleExerciseSummary['progression_recommendation'] = 'maintain';
    let notes = 'No iron logs in 21-day mesocycle — establish baseline @ 2 RIR';

    if (last) {
      const hitReps =
        last.reps_completed != null &&
        meta != null &&
        last.reps_completed >= meta.default_reps - 1;
      if (last.rpe_score != null && last.rpe_score >= 9) {
        progression = 'deload';
        notes = `Last RPE ${last.rpe_score} — deload load ~5% or add 1 RIR`;
      } else if (last.rpe_score != null && last.rpe_score <= 8 && hitReps) {
        progression = 'load';
        notes = `Hit reps at RPE ${last.rpe_score} — progress load ~2.5% or top of rep range +1`;
      } else if (last.rpe_score != null && last.rpe_score <= 8) {
        progression = 'volume';
        notes = `RPE ${last.rpe_score} but rep target missed — add reps before load`;
      } else {
        progression = 'maintain';
        notes = 'Maintain — insufficient RPE data';
      }
    }

    return {
      exercise_id: exerciseId,
      exercise_name: meta?.name ?? 'Unknown',
      sessions_logged: logs.length,
      last_weight_kg: last?.weight_used ?? null,
      last_reps: last?.reps_completed ?? null,
      last_rpe: last?.rpe_score ?? null,
      avg_rpe_3w: avgRpe,
      progression_recommendation: progression,
      notes,
    };
  });
}

function detectIronAutoregulation(
  biological: BiologicalPassport,
  yesterdayMainRpe: number | null,
): IronAutoregulationState {
  const stress = biological.baseline_stress_level;
  const highStress = stress != null && stress > 7;
  const poorRecovery =
    highStress ||
    (yesterdayMainRpe != null && yesterdayMainRpe >= 8) ||
    (stress != null && stress >= 7 && yesterdayMainRpe != null && yesterdayMainRpe >= 7);

  return {
    high_stress_mode: highStress,
    poor_recovery: poorRecovery,
    baseline_stress_level: stress,
    current_injuries: biological.current_injuries,
    blocked_joint_profiles: parseBlockedJointProfiles(biological.current_injuries),
    swaps_applied: [],
  };
}

function findLowerFatigueSwap(
  exerciseId: string,
  catalog: LibraryExercise[],
  blockedProfiles: string[],
  equipment: string[],
): { id: string; reason: string } | null {
  const current = catalog.find((row) => row.id === exerciseId);
  if (!current?.primary_muscle) return null;
  const cns = current.cns_fatigue_cost ?? 3;
  if (cns < HIGH_CNS_SWAP_THRESHOLD) return null;

  const alternatives = catalog
    .filter(
      (row) =>
        row.id !== exerciseId &&
        row.primary_muscle === current.primary_muscle &&
        (row.cns_fatigue_cost ?? 5) <= LOW_CNS_SWAP_MAX &&
        !isExerciseBlocked(row, blockedProfiles) &&
        equipmentMatches(row, equipment),
    )
    .sort(
      (a, b) => (a.cns_fatigue_cost ?? 5) - (b.cns_fatigue_cost ?? 5),
    );

  const pick = alternatives[0];
  if (!pick) return null;

  return {
    id: pick.id,
    reason: `CNS swap: ${current.name} (cost ${cns}) → ${pick.name} (cost ${pick.cns_fatigue_cost}) same ${current.primary_muscle}`,
  };
}

function applyIronRoutineAutoregulation(
  baseRoutineIds: string[],
  catalog: LibraryExercise[],
  equipment: string[],
  autoreg: IronAutoregulationState,
): string[] {
  const blocked = autoreg.blocked_joint_profiles;
  const shouldSwapCns = autoreg.high_stress_mode || autoreg.poor_recovery;

  return baseRoutineIds.map((exerciseId) => {
    let resolvedId = exerciseId;
    const meta = catalog.find((row) => row.id === exerciseId);

    if (meta && isExerciseBlocked(meta, blocked)) {
      const replacement = catalog.find(
        (row) =>
          row.primary_muscle === meta.primary_muscle &&
          row.id !== exerciseId &&
          !isExerciseBlocked(row, blocked) &&
          equipmentMatches(row, equipment),
      );
      if (replacement) {
        autoreg.swaps_applied.push({
          from_exercise_id: exerciseId,
          to_exercise_id: replacement.id,
          reason: `Injury filter: avoid ${meta.joint_stress_profile}`,
        });
        resolvedId = replacement.id;
      }
    }

    if (shouldSwapCns) {
      const swap = findLowerFatigueSwap(resolvedId, catalog, blocked, equipment);
      if (swap) {
        autoreg.swaps_applied.push({
          from_exercise_id: resolvedId,
          to_exercise_id: swap.id,
          reason: swap.reason,
        });
        resolvedId = swap.id;
      }
    }

    return resolvedId;
  });
}

function defaultRepRange(meta: LibraryExercise | undefined, targetRir: number): string {
  const hi = meta?.default_reps ?? 10;
  const lo = Math.max(6, hi - 2);
  return `${lo}-${hi} @ ${targetRir} RIR`;
}

function pickExecutionTechnique(
  meta: LibraryExercise | undefined,
  progression: MesocycleExerciseSummary['progression_recommendation'],
  autoreg: IronAutoregulationState,
): IronExecutionTechnique {
  const cns = meta?.cns_fatigue_cost ?? 3;
  if (autoreg.poor_recovery || progression === 'deload') {
    return meta?.stretch_mediated_hypertrophy ? 'Slow Eccentric (4s)' : 'Standard';
  }
  if (progression === 'load' && cns <= 2 && !autoreg.high_stress_mode) {
    return 'Myo-Reps';
  }
  if (progression === 'volume' && cns <= 2) {
    return 'Standard';
  }
  return 'Standard';
}

function prescribeIronExercise(
  exerciseId: string,
  catalog: LibraryExercise[],
  mesocycle: MesocycleExerciseSummary | undefined,
  autoreg: IronAutoregulationState,
  baselineWeightKg: number | null,
  ironLogs3w: PerformanceLogRow[],
  weeklyVolume: WeeklyMuscleVolumeRow[],
  equipment: string[],
): IronExercisePrescription {
  const meta = catalog.find((row) => row.id === exerciseId);
  const last = ironLogs3w.find((log) => log.exercise_id === exerciseId);
  const progression = mesocycle?.progression_recommendation ?? 'maintain';

  let targetRir = autoreg.poor_recovery ? 3 : 2;
  if (progression === 'deload') targetRir = 4;

  let targetReps = meta?.default_reps ?? 10;
  let targetWeight: number | null = last?.weight_used ?? null;
  let note = mesocycle?.notes ?? 'Baseline prescription';

  if (targetWeight == null && baselineWeightKg != null) {
    targetWeight = Math.round(baselineWeightKg * 0.35 * 10) / 10;
    note = `Estimated from ${baselineWeightKg} kg body mass`;
  }

  if (last?.weight_used != null && last.rpe_score != null) {
    if (progression === 'deload' || last.rpe_score >= 9) {
      targetWeight = Math.round(last.weight_used * 0.95 * 10) / 10;
      targetRir = 4;
      note = `Mesocycle deload — last RPE ${last.rpe_score}`;
    } else if (progression === 'load' && last.rpe_score <= 8) {
      targetWeight = Math.round(last.weight_used * 1.025 * 10) / 10;
      targetReps = Math.min(15, (last.reps_completed ?? targetReps) + 1);
      note = `Load progression — 21d mesocycle, RPE ${last.rpe_score}`;
    } else if (progression === 'volume') {
      targetReps = Math.min(15, targetReps + 1);
      note = `Volume progression — add reps before load`;
    }
  }

  const repRange = defaultRepRange(meta, targetRir);
  const technique = pickExecutionTechnique(meta, progression, autoreg);
  let sets = meta?.default_sets ?? 4;
  if (autoreg.poor_recovery && (meta?.cns_fatigue_cost ?? 0) >= HIGH_CNS_SWAP_THRESHOLD) {
    sets = Math.max(2, sets - 1);
  }

  const volumeCap = applyWeeklyVolumeSetCap(
    sets,
    meta?.primary_muscle ?? null,
    weeklyVolume,
    autoreg,
  );
  sets = volumeCap.sets;

  const notes = [note, volumeCap.volumeNote].filter(Boolean).join(' · ');
  const restSeconds = computeRestSecondsFromCns(meta?.cns_fatigue_cost ?? null);
  const alternativeId = findAlternativeExerciseId(
    exerciseId,
    catalog,
    autoreg.blocked_joint_profiles,
    equipment,
  );

  return {
    exercise_id: exerciseId,
    target_sets: sets,
    target_reps: targetReps,
    target_rep_range: repRange,
    target_rir: targetRir,
    target_weight_kg: targetWeight,
    rest_seconds: restSeconds,
    alternative_exercise_id: alternativeId,
    progression_note: notes || note,
    execution_technique: technique,
  };
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function equipmentMatches(
  exercise: LibraryExercise,
  availableEquipment: string[],
): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag));
}

const LIBRARY_COMBAT_SELECT =
  'id, slug, combo_name, sequence, complexity_level, tactical_focus';

const LIBRARY_FLOW_SPIRIT_SELECT =
  'id, slug, pillar, session_name, description, duration_minutes, tempo_profile, complexity_level, target_recovery_zones, complexity_tier, is_dynamic_flow, default_hold_seconds';

/**
 * MANDATORY pre-LLM catalog load — all movement prescriptions must come from these rows.
 * Equipment is sourced from user_environment (DB), with request body as fallback only.
 */
async function fetchMandatoryCatalogAssets(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  bodyEquipment: string[] | undefined,
): Promise<MandatoryCatalogAssets> {
  const fetch_errors: string[] = [];

  const [envRes, exercisesRes, combosRes, flowRes] = await Promise.all([
    supabase
      .from('user_environment')
      .select('available_equipment')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('library_exercises').select(LIBRARY_EXERCISE_SELECT),
    supabase.from('library_combat').select(LIBRARY_COMBAT_SELECT),
    supabase.from('library_flow_spirit').select(LIBRARY_FLOW_SPIRIT_SELECT),
  ]);

  if (envRes.error) fetch_errors.push(`user_environment: ${envRes.error.message}`);
  if (exercisesRes.error) fetch_errors.push(`library_exercises: ${exercisesRes.error.message}`);
  if (combosRes.error) fetch_errors.push(`library_combat: ${combosRes.error.message}`);
  if (flowRes.error) fetch_errors.push(`library_flow_spirit: ${flowRes.error.message}`);

  const dbEquipment = Array.isArray(envRes.data?.available_equipment)
    ? (envRes.data.available_equipment as unknown[]).map(String)
    : [];
  const available_equipment =
    dbEquipment.length > 0 ? dbEquipment : (bodyEquipment ?? []);

  const exercises_all: LibraryExercise[] = (exercisesRes.data ?? []).map((row) =>
    mapLibraryExerciseRow(row as Record<string, unknown>),
  );
  const exercises = exercises_all.filter((row) => equipmentMatches(row, available_equipment));

  const combat: LibraryCombo[] = (combosRes.data ?? []).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    combo_name: String(row.combo_name),
    sequence: Array.isArray(row.sequence) ? row.sequence.map(String) : [],
    complexity_level:
      typeof row.complexity_level === 'number' ? row.complexity_level : 5,
    tactical_focus: parseCombatTacticalFocus(row.tactical_focus) ?? 'footwork_range',
  }));

  const flow_spirit: LibraryFlowSpiritRow[] = (flowRes.data ?? []).map((row) =>
    mapFlowSpiritRow(row as Record<string, unknown>),
  );

  const spirit_tempo_ids = flow_spirit
    .filter((row) => row.pillar === 'spirit')
    .map((row) => SPIRIT_SLUG_TO_TEMPO_ID[row.slug] ?? row.slug);

  const tempoFallback =
    spirit_tempo_ids.length === 0 ? SPIRIT_TEMPO_CATALOG.map((t) => t.id) : spirit_tempo_ids;

  console.log('[generate_daily_protocol] Mandatory catalog fetch:', {
    user_id: userId,
    available_equipment,
    equipment_source: dbEquipment.length > 0 ? 'user_environment' : 'request_body',
    library_exercises_total: exercises_all.length,
    library_exercises_equipment_filtered: exercises.length,
    library_combat_total: combat.length,
    library_flow_spirit_total: flow_spirit.length,
    library_flow_rows: flow_spirit.filter((r) => r.pillar === 'flow').length,
    library_spirit_rows: flow_spirit.filter((r) => r.pillar === 'spirit').length,
    fetch_errors,
  });

  return {
    available_equipment,
    exercises_all,
    exercises,
    combat,
    flow_spirit,
    spirit_tempo_ids: tempoFallback,
    fetch_errors,
  };
}

/** Compact catalog snapshot embedded in the system prompt */
function buildAvailableAssetsTag(assets: MandatoryCatalogAssets): string {
  const payload = {
    available_equipment: assets.available_equipment,
    exercises: assets.exercises.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      equipment_required: row.equipment_required,
      primary_muscle: row.primary_muscle,
      movement_pattern: row.movement_pattern,
      cns_fatigue_cost: row.cns_fatigue_cost,
      joint_stress_profile: row.joint_stress_profile,
      default_sets: row.default_sets,
      default_reps: row.default_reps,
    })),
    combat: assets.combat.map((row) => ({
      id: row.id,
      slug: row.slug,
      combo_name: row.combo_name,
      tactical_focus: row.tactical_focus,
      complexity_level: row.complexity_level,
      sequence: row.sequence,
    })),
    flow: assets.flow_spirit
      .filter((row) => row.pillar === 'flow')
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        session_name: row.session_name,
        target_recovery_zones: row.target_recovery_zones,
        complexity_tier: row.complexity_tier,
        default_hold_seconds: row.default_hold_seconds,
        is_dynamic_flow: row.is_dynamic_flow,
      })),
    spirit_breathwork: assets.flow_spirit
      .filter((row) => row.pillar === 'spirit')
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        tempo_id: SPIRIT_SLUG_TO_TEMPO_ID[row.slug] ?? row.slug,
        session_name: row.session_name,
        duration_minutes: row.duration_minutes,
        tempo_profile: row.tempo_profile,
      })),
  };

  return `<AVAILABLE_ASSETS>\n${JSON.stringify(payload)}\n</AVAILABLE_ASSETS>`;
}

function resolveIronRoutineIds(
  catalog: LibraryExercise[],
  lastIronExerciseIds: string[] | null,
): string[] {
  if (lastIronExerciseIds && lastIronExerciseIds.length > 0) {
    const valid = lastIronExerciseIds.filter((id) => catalog.some((row) => row.id === id));
    if (valid.length > 0) return valid;
  }

  const push = catalog.find((row) => row.movement_pattern === 'push');
  const hinge = catalog.find((row) => row.movement_pattern === 'hinge');
  const pull = catalog.find((row) => row.movement_pattern === 'pull');

  const routine: string[] = [];
  if (push) routine.push(push.id);
  if (hinge) routine.push(hinge.id);
  if (pull) routine.push(pull.id);

  if (routine.length === 0) return catalog.slice(0, 3).map((row) => row.id);
  return routine;
}

function maxComboComplexityForMastery(mastery: number): number {
  if (mastery >= 20) return 10;
  if (mastery >= 12) return 8;
  if (mastery >= 6) return 5;
  return 3;
}

function buildDeterministicIronBlock(
  routineId: string,
  catalog: LibraryExercise[],
  routineIds: string[],
  ironLogs3w: PerformanceLogRow[],
  ironLogs7d: PerformanceLogRow[],
  baselineWeightKg: number | null,
  autoreg: IronAutoregulationState,
  equipment: string[],
): GameplanBlockPayload {
  const mesocycle = buildMesocycleSummaries(routineIds, catalog, ironLogs3w);
  const mesocycleById = new Map(mesocycle.map((row) => [row.exercise_id, row]));
  const weeklyVolume = buildWeeklyVolumeByMuscle(catalog, ironLogs7d);

  const exercises: IronExercisePrescription[] = routineIds.map((exerciseId) =>
    prescribeIronExercise(
      exerciseId,
      catalog,
      mesocycleById.get(exerciseId),
      autoreg,
      baselineWeightKg,
      ironLogs3w,
      weeklyVolume,
      equipment,
    ),
  );

  const names = routineIds
    .map((id) => catalog.find((row) => row.id === id)?.name)
    .filter(Boolean)
    .join(' · ');

  return {
    id: 'block-main-iron',
    pillar: 'iron',
    title: 'Main Ritual: Iron',
    subtitle: names || 'Iron routine',
    duration_minutes: 45,
    order: 1,
    iron: { routine_id: routineId, exercises },
  };
}

function parseCombatTacticalFocus(value: unknown): CombatTacticalFocus | null {
  return typeof value === 'string' &&
      COMBAT_TACTICAL_FOCUS_VALUES.includes(value as CombatTacticalFocus)
    ? (value as CombatTacticalFocus)
    : null;
}

function combosForTacticalFocus(
  source: LibraryCombo[],
  focus: CombatTacticalFocus,
): LibraryCombo[] {
  const matched = source.filter((combo) => combo.tactical_focus === focus);
  return matched.length > 0 ? matched : source;
}

function pickComboForRound(
  source: LibraryCombo[],
  focus: CombatTacticalFocus,
  roundIndex: number,
): LibraryCombo {
  const pool = combosForTacticalFocus(source, focus);
  return pool[(roundIndex - 1) % pool.length]!;
}

function workRestForTacticalFocus(focus: CombatTacticalFocus): {
  work_seconds: number;
  rest_seconds: number;
} {
  if (focus === 'burnout') return { work_seconds: 150, rest_seconds: 45 };
  return { work_seconds: 180, rest_seconds: 60 };
}

function deriveRoundsStructureFromRounds(
  rounds: CombatRoundPrescription[],
): CombatRoundStructureEntry[] {
  if (rounds.length === 0) return [];
  const segments: CombatRoundStructureEntry[] = [];
  let segmentStart = rounds[0]!.round_index;
  let currentFocus = rounds[0]!.tactical_focus;

  for (let i = 1; i < rounds.length; i += 1) {
    const round = rounds[i]!;
    if (round.tactical_focus === currentFocus) continue;
    segments.push({
      round_start: segmentStart,
      round_end: rounds[i - 1]!.round_index,
      tactical_focus: currentFocus,
    });
    segmentStart = round.round_index;
    currentFocus = round.tactical_focus;
  }

  segments.push({
    round_start: segmentStart,
    round_end: rounds[rounds.length - 1]!.round_index,
    tactical_focus: currentFocus,
  });

  return segments;
}

function buildTacticalRoundPlan(
  highFatigue: boolean,
): CombatRoundStructureEntry[] {
  if (highFatigue) {
    return [
      {
        round_start: 1,
        round_end: 1,
        tactical_focus: 'footwork_range',
        coach_intent: 'Light feet — jab/teep rhythm, slip exits, no power chase.',
      },
      {
        round_start: 2,
        round_end: 2,
        tactical_focus: 'defense_counter',
        coach_intent: 'Shell, parry, check kick — counter only on clean reads.',
      },
      {
        round_start: 3,
        round_end: 3,
        tactical_focus: 'burnout',
        coach_intent: 'Controlled burnout — sprawl between bursts, stay technical.',
      },
    ];
  }

  return [
    {
      round_start: 1,
      round_end: 1,
      tactical_focus: 'footwork_range',
      coach_intent: 'Win range first — teeps, angles, probe jab, exit after cross.',
    },
    {
      round_start: 2,
      round_end: 3,
      tactical_focus: 'power_inside',
      coach_intent: 'Close safely — body shots, hooks, clinch knees; hands home on exit.',
    },
    {
      round_start: 4,
      round_end: 4,
      tactical_focus: 'defense_counter',
      coach_intent: 'Defense layer — slip/roll, parry, check kick, counter cross.',
    },
  ];
}

function buildDeterministicCombatBlock(
  combos: LibraryCombo[],
  mastery: number,
  yesterdayMainRpe: number | null,
  baselineStress: number | null,
): GameplanBlockPayload | null {
  if (combos.length === 0) return null;

  const maxLevel = maxComboComplexityForMastery(mastery);
  const pool = combos.filter((combo) => combo.complexity_level <= maxLevel);
  const source = pool.length > 0 ? pool : combos;

  const highFatigue =
    (yesterdayMainRpe != null && yesterdayMainRpe >= 8) ||
    (baselineStress != null && baselineStress >= 7);

  const rounds_structure = buildTacticalRoundPlan(highFatigue);
  const rounds: CombatRoundPrescription[] = [];

  for (const segment of rounds_structure) {
    for (let roundIndex = segment.round_start; roundIndex <= segment.round_end; roundIndex += 1) {
      const combo = pickComboForRound(source, segment.tactical_focus, roundIndex);
      const timing = workRestForTacticalFocus(segment.tactical_focus);
      rounds.push({
        round_index: roundIndex,
        combo_id: combo.id,
        tactical_focus: segment.tactical_focus,
        work_seconds: timing.work_seconds,
        rest_seconds: timing.rest_seconds,
      });
    }
  }

  const structureLabel = rounds_structure
    .map((segment) => {
      const range =
        segment.round_start === segment.round_end
          ? `R${segment.round_start}`
          : `R${segment.round_start}–${segment.round_end}`;
      return `${range} ${segment.tactical_focus.replace(/_/g, ' ')}`;
    })
    .join(' → ');

  return {
    id: 'block-main-combat',
    pillar: 'combat',
    title: 'Main Ritual: Blood & Bone',
    subtitle: structureLabel,
    duration_minutes: highFatigue ? 32 : 40,
    order: 1,
    combat: { rounds_structure, rounds },
  };
}

function filterLogsLastHours(logs: PerformanceLogRow[], hours: number): PerformanceLogRow[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return logs.filter((log) => Date.parse(log.timestamp) >= cutoff);
}

function mapFlowSpiritRow(row: Record<string, unknown>): LibraryFlowSpiritRow {
  const zones = Array.isArray(row.target_recovery_zones)
    ? row.target_recovery_zones.map(String)
    : [];
  const tierRaw = row.complexity_tier ?? row.complexity_level;
  const tier =
    typeof tierRaw === 'number'
      ? Math.min(3, Math.max(1, Math.round(tierRaw > 3 ? Math.ceil(tierRaw / 3) : tierRaw)))
      : 2;

  return {
    id: String(row.id),
    slug: String(row.slug),
    pillar: row.pillar === 'spirit' ? 'spirit' : 'flow',
    session_name: String(row.session_name),
    description: typeof row.description === 'string' ? row.description : null,
    duration_minutes:
      typeof row.duration_minutes === 'number' ? row.duration_minutes : 15,
    tempo_profile:
      row.tempo_profile && typeof row.tempo_profile === 'object'
        ? (row.tempo_profile as Record<string, unknown>)
        : {},
    complexity_level:
      typeof row.complexity_level === 'number' ? row.complexity_level : 3,
    target_recovery_zones: zones,
    complexity_tier: tier,
    is_dynamic_flow: row.is_dynamic_flow === true,
    default_hold_seconds:
      typeof row.default_hold_seconds === 'number' ? row.default_hold_seconds : 45,
  };
}

function maxComplexityTierForSpiritEssence(spiritEssence: number): number {
  return spiritEssence <= SPIRIT_BEGINNER_ESSENCE_MAX ? 1 : 3;
}

function exerciseIdFromLog(log: PerformanceLogRow): string | null {
  if (log.exercise_id) return log.exercise_id;
  const payloadId = log.payload?.iron?.exercise_id;
  return typeof payloadId === 'string' ? payloadId : null;
}

function isLowerBodyIronExercise(
  exercise: LibraryExercise | undefined,
  exerciseId: string | null,
): boolean {
  if (!exercise && exerciseId) {
    const slugGuess = exerciseId.toLowerCase();
    return LOWER_BODY_SLUG_HINTS.some((hint) => slugGuess.includes(hint));
  }
  if (!exercise) return false;

  if (exercise.primary_muscle && LOWER_BODY_MUSCLES.has(exercise.primary_muscle)) {
    return true;
  }
  if (
    exercise.movement_pattern &&
    LOWER_BODY_PATTERNS.has(exercise.movement_pattern.toLowerCase())
  ) {
    return true;
  }
  const slug = exercise.slug?.toLowerCase() ?? '';
  return LOWER_BODY_SLUG_HINTS.some((hint) => slug.includes(hint));
}

function zonesOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((zone) => setB.has(zone));
}

function analyzeHealerRecovery48h(
  logs: PerformanceLogRow[],
  exerciseCatalog: LibraryExercise[],
  spiritEssence: number,
): HealerRecoveryState {
  const logs48h = filterLogsLastHours(logs, HEALER_WINDOW_HOURS);
  const exerciseById = new Map(exerciseCatalog.map((row) => [row.id, row]));

  const requiredZones = new Set<string>();
  let ironLowerBodyHeavy = false;
  let combatLoadHigh = false;

  for (const log of logs48h) {
    if (log.pillar === 'iron') {
      const exId = exerciseIdFromLog(log);
      const meta = exId ? exerciseById.get(exId) : undefined;
      if (isLowerBodyIronExercise(meta, exId)) {
        ironLowerBodyHeavy = true;
        requiredZones.add('lower_back');
        requiredZones.add('hips');
        requiredZones.add('glutes');
        requiredZones.add('hamstrings');
      } else if (meta?.primary_muscle === 'upper_chest' || meta?.movement_pattern === 'push') {
        requiredZones.add('shoulders');
        requiredZones.add('thoracic_spine');
      } else if (meta?.movement_pattern === 'pull') {
        requiredZones.add('shoulders');
        requiredZones.add('thoracic_spine');
      }
    }

    if (log.pillar === 'combat') {
      const rpe = log.rpe_score ?? 0;
      const volume = log.payload && typeof log.payload === 'object'
        ? Number((log.payload as { volume?: number }).volume) || 0
        : 0;
      if (rpe >= 6 || volume >= 480) {
        combatLoadHigh = true;
        requiredZones.add('hips');
        requiredZones.add('lower_back');
        requiredZones.add('ankles');
      }
    }
  }

  if (requiredZones.size === 0) {
    requiredZones.add('hips');
    requiredZones.add('thoracic_spine');
  }

  const maxTier = maxComplexityTierForSpiritEssence(spiritEssence);
  const zoneList = [...requiredZones];

  let reason = `Biomechanical restore — ${HEALER_WINDOW_HOURS}h scan (${logs48h.length} sessions)`;
  if (ironLowerBodyHeavy) {
    reason += ' · lower-body Iron load → hip & lumbar focus';
  }
  if (combatLoadHigh) {
    reason += ' · combat volume → hip & ankle recovery';
  }
  if (spiritEssence <= SPIRIT_BEGINNER_ESSENCE_MAX) {
    reason += ' · beginner spirit essence → tier 1 asanas only';
  }

  return {
    window_hours: HEALER_WINDOW_HOURS,
    logs_analyzed: logs48h.length,
    spirit_essence: spiritEssence,
    max_complexity_tier: maxTier,
    required_recovery_zones: zoneList,
    iron_lower_body_heavy: ironLowerBodyHeavy,
    combat_load_high: combatLoadHigh,
    prescribed_reason: reason,
  };
}

function scoreFlowRowForHealer(row: LibraryFlowSpiritRow, healer: HealerRecoveryState): number {
  let score = 0;
  for (const zone of healer.required_recovery_zones) {
    if (row.target_recovery_zones.includes(zone)) score += 2;
  }
  if (healer.iron_lower_body_heavy && zonesOverlap(row.target_recovery_zones, [...LOWER_BODY_RECOVERY_ZONES])) {
    score += 5;
  }
  return score;
}

function filterFlowCatalogForHealer(
  catalog: LibraryFlowSpiritRow[],
  healer: HealerRecoveryState,
  allowedIds: string[],
): LibraryFlowSpiritRow[] {
  const allowed = new Set(allowedIds);
  let pool = catalog.filter(
    (row) =>
      row.pillar === 'flow' &&
      allowed.has(row.id) &&
      row.complexity_tier <= healer.max_complexity_tier,
  );

  if (healer.iron_lower_body_heavy) {
    const strict = pool.filter((row) =>
      zonesOverlap(row.target_recovery_zones, [...LOWER_BODY_RECOVERY_ZONES]),
    );
    if (strict.length > 0) pool = strict;
  }

  if (pool.length === 0) {
    pool = catalog.filter(
      (row) =>
        row.pillar === 'flow' &&
        allowed.has(row.id) &&
        row.complexity_tier <= healer.max_complexity_tier,
    );
  }

  return pool.sort(
    (a, b) => scoreFlowRowForHealer(b, healer) - scoreFlowRowForHealer(a, healer),
  );
}

function buildFlowBlockFromHealer(
  flowCatalog: LibraryFlowSpiritRow[],
  allowedFlowIds: string[],
  healer: HealerRecoveryState,
  yesterdayRpe: number | null,
  order: number,
  id: string,
  title: string,
): GameplanBlockPayload | null {
  const pool = filterFlowCatalogForHealer(flowCatalog, healer, allowedFlowIds);
  if (pool.length === 0) return null;

  const targetCount = yesterdayRpe != null && yesterdayRpe >= 8 ? 7 : 5;
  const picks: LibraryFlowSpiritRow[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    picks.push(pool[i % pool.length]!);
  }

  const asanas: FlowAsanaPrescription[] = picks.map((row, index) => ({
    asana_id: row.id,
    slug: row.slug,
    name: row.session_name,
    order: index + 1,
    hold_seconds: row.is_dynamic_flow
      ? Math.max(30, Math.round(row.default_hold_seconds || 30))
      : row.default_hold_seconds || 45,
    target_recovery_zones: row.target_recovery_zones,
    is_dynamic_flow: row.is_dynamic_flow,
  }));

  const holdTotalSec = asanas.reduce((sum, row) => sum + row.hold_seconds, 0);
  const durationMinutes = Math.max(
    10,
    Math.min(25, Math.round(holdTotalSec / 60) + Math.ceil(asanas.length * 0.5)),
  );

  const zoneLabel = healer.required_recovery_zones.slice(0, 2).join(' · ');

  return {
    id,
    pillar: 'spirit',
    title,
    subtitle: `${asanas[0]!.name} → ${zoneLabel}`,
    duration_minutes: durationMinutes,
    order,
    spirit: {
      mode: 'flow',
      duration_minutes: durationMinutes,
      prescribed_reason: healer.prescribed_reason,
      recovery_focus_zones: healer.required_recovery_zones,
      asanas,
    },
  };
}

function buildSpiritBlockFromRpe(
  yesterdayRpe: number | null,
  order: number,
  id: string,
  title: string,
): GameplanBlockPayload {
  let duration = 15;
  let tempoId = 'tempo_box';
  let reason = 'Default — no prior main-workout RPE';

  if (yesterdayRpe != null) {
    if (yesterdayRpe >= 8) {
      duration = 20;
      tempoId = 'tempo_478';
      reason = `Recovery — prior main RPE ${yesterdayRpe}`;
    } else if (yesterdayRpe >= 5) {
      duration = 16;
      tempoId = 'tempo_box';
      reason = `Moderate recovery — prior main RPE ${yesterdayRpe}`;
    } else {
      duration = 12;
      tempoId = 'tempo_relax';
      reason = `Primer — prior main RPE ${yesterdayRpe}`;
    }
  }

  const tempo = SPIRIT_TEMPO_CATALOG.find((row) => row.id === tempoId)!;

  return {
    id,
    pillar: 'spirit',
    title,
    subtitle: `${tempo.name} · ${duration} min`,
    duration_minutes: duration,
    order,
    spirit: {
      mode: 'breathwork',
      tempo_id: tempoId,
      duration_minutes: duration,
      prescribed_reason: reason,
    },
  };
}

function sanitizeBlueprint(
  raw: AiBlueprintResponse,
  routineExerciseIds: string[],
  allowedComboIds: string[],
  allowedTempoIds: string[],
  allowedFlowIds: string[],
  catalog: LibraryExercise[],
  comboCatalog: LibraryCombo[],
  flowCatalog: LibraryFlowSpiritRow[],
  healer: HealerRecoveryState,
  equipment: string[],
  autoreg: IronAutoregulationState,
  weeklyVolume: WeeklyMuscleVolumeRow[],
): GameplanBlockPayload[] {
  const routineSet = new Set(routineExerciseIds);
  const comboSet = new Set(allowedComboIds);
  const tempoSet = new Set(allowedTempoIds);

  return raw.blocks.flatMap((block, index): GameplanBlockPayload[] => {
    if (!['iron', 'combat', 'spirit'].includes(block.pillar)) return [];

    const sanitized: GameplanBlockPayload = {
      id: block.id ?? `block-ai-${index}`,
      pillar: block.pillar,
      title: block.title ?? 'Ritual Block',
      subtitle: block.subtitle ?? '',
      duration_minutes: Number(block.duration_minutes) || 20,
      order: Number.isFinite(block.order) ? block.order : index,
    };

    if (block.pillar === 'iron' && block.iron?.exercises) {
      const exercises = block.iron.exercises
        .filter((row) => routineSet.has(row.exercise_id))
        .map((row) => {
          const meta = catalog.find((item) => item.id === row.exercise_id);
          const rawTechnique = row.execution_technique;
          const technique = VALID_EXECUTION_TECHNIQUES.includes(
            rawTechnique as IronExecutionTechnique,
          )
            ? (rawTechnique as IronExecutionTechnique)
            : 'Standard';
          const targetRir = Number(row.target_rir);
          const rir =
            Number.isFinite(targetRir) && targetRir >= 0 && targetRir <= 4
              ? targetRir
              : 2;
          const repRange =
            typeof row.target_rep_range === 'string' && row.target_rep_range.trim()
              ? row.target_rep_range.trim()
              : defaultRepRange(meta, rir);

          const rawRest = Number(row.rest_seconds);
          const restSeconds =
            Number.isFinite(rawRest) && rawRest >= 60 && rawRest <= 180
              ? Math.round(rawRest)
              : computeRestSecondsFromCns(meta?.cns_fatigue_cost ?? null);

          let alternativeId: string | null = null;
          if (typeof row.alternative_exercise_id === 'string') {
            const altMeta = catalog.find((item) => item.id === row.alternative_exercise_id);
            if (
              altMeta &&
              altMeta.id !== row.exercise_id &&
              altMeta.primary_muscle === meta?.primary_muscle &&
              (altMeta.cns_fatigue_cost ?? 5) <= (meta?.cns_fatigue_cost ?? 5)
            ) {
              alternativeId = altMeta.id;
            }
          }
          if (!alternativeId) {
            alternativeId = findAlternativeExerciseId(
              row.exercise_id,
              catalog,
              autoreg.blocked_joint_profiles,
              equipment,
            );
          }

          let targetSets = Number(row.target_sets) || meta?.default_sets || 4;
          const volumeCap = applyWeeklyVolumeSetCap(
            targetSets,
            meta?.primary_muscle ?? null,
            weeklyVolume,
            autoreg,
          );
          targetSets = volumeCap.sets;
          const progressionNote = [
            typeof row.progression_note === 'string' ? row.progression_note : 'Validated overload',
            volumeCap.volumeNote,
          ]
            .filter(Boolean)
            .join(' · ');

          return {
            exercise_id: row.exercise_id,
            target_sets: targetSets,
            target_reps: Number(row.target_reps) || meta?.default_reps || 8,
            target_rep_range: repRange,
            target_rir: rir,
            target_weight_kg:
              row.target_weight_kg === null || row.target_weight_kg === undefined
                ? null
                : Number(row.target_weight_kg),
            rest_seconds: restSeconds,
            alternative_exercise_id: alternativeId,
            progression_note: progressionNote,
            execution_technique: technique,
          };
        });

      if (exercises.length > 0) {
        sanitized.iron = {
          routine_id: block.iron.routine_id ?? 'iron_routine_a',
          exercises,
        };
        sanitized.subtitle = exercises
          .map((row) => catalog.find((item) => item.id === row.exercise_id)?.name)
          .filter(Boolean)
          .join(' · ');
      }
    }

    if (block.pillar === 'combat' && block.combat?.rounds) {
      const structureRaw = block.combat.rounds_structure ?? [];
      const parsedStructure = Array.isArray(structureRaw)
        ? structureRaw.flatMap((entry): CombatRoundStructureEntry[] => {
            if (!entry || typeof entry !== 'object') return [];
            const row = entry as Record<string, unknown>;
            const focus = parseCombatTacticalFocus(row.tactical_focus);
            const roundStart = Number(row.round_start ?? row.round_index_start);
            const roundEnd = Number(row.round_end ?? row.round_index_end);
            if (!focus || !Number.isFinite(roundStart) || !Number.isFinite(roundEnd)) {
              return [];
            }
            if (roundStart < 1 || roundEnd < roundStart) return [];
            return [
              {
                round_start: roundStart,
                round_end: roundEnd,
                tactical_focus: focus,
                coach_intent:
                  typeof row.coach_intent === 'string'
                    ? row.coach_intent
                    : typeof row.intent === 'string'
                      ? row.intent
                      : undefined,
              },
            ];
          })
        : [];

      const rounds = block.combat.rounds
        .filter((round) => comboSet.has(round.combo_id))
        .map((round, roundIndex) => {
          const roundNum = Number(round.round_index) || roundIndex + 1;
          const segmentFocus =
            parsedStructure.find(
              (segment) => roundNum >= segment.round_start && roundNum <= segment.round_end,
            )?.tactical_focus ?? null;
          const catalogCombo = comboCatalog.find((combo) => combo.id === round.combo_id);
          const tactical_focus =
            parseCombatTacticalFocus(round.tactical_focus) ??
            segmentFocus ??
            catalogCombo?.tactical_focus ??
            'footwork_range';
          const timing = workRestForTacticalFocus(tactical_focus);
          return {
            round_index: roundNum,
            combo_id: round.combo_id,
            tactical_focus,
            work_seconds: Number(round.work_seconds) || timing.work_seconds,
            rest_seconds: Number(round.rest_seconds) || timing.rest_seconds,
          };
        });

      if (rounds.length > 0) {
        const rounds_structure =
          parsedStructure.length > 0
            ? parsedStructure
            : deriveRoundsStructureFromRounds(rounds);
        sanitized.combat = { rounds_structure, rounds };
        sanitized.subtitle = rounds_structure
          .map((segment) => {
            const range =
              segment.round_start === segment.round_end
                ? `R${segment.round_start}`
                : `R${segment.round_start}–${segment.round_end}`;
            return `${range} ${segment.tactical_focus.replace(/_/g, ' ')}`;
          })
          .join(' → ');
      }
    }

    if (block.pillar === 'spirit' && block.spirit) {
      const spiritMode = block.spirit.mode === 'flow' ? 'flow' : 'breathwork';

      if (spiritMode === 'flow' && Array.isArray(block.spirit.asanas)) {
        const flowSet = new Set(allowedFlowIds);
        const asanas = block.spirit.asanas
          .filter((row) => flowSet.has(row.asana_id))
          .map((row, index) => {
            const catalogRow = flowCatalog.find((item) => item.id === row.asana_id);
            const hold =
              Number(row.hold_seconds) ||
              catalogRow?.default_hold_seconds ||
              45;
            return {
              asana_id: row.asana_id,
              slug: catalogRow?.slug ?? row.slug ?? '',
              name: catalogRow?.session_name ?? row.name ?? 'Asana',
              order: Number(row.order) || index + 1,
              hold_seconds: hold,
              target_recovery_zones:
                catalogRow?.target_recovery_zones ??
                row.target_recovery_zones ??
                [],
              is_dynamic_flow: catalogRow?.is_dynamic_flow ?? row.is_dynamic_flow === true,
            };
          })
          .sort((a, b) => a.order - b.order);

        if (asanas.length > 0) {
          const duration = Number(block.spirit.duration_minutes) || 15;
          sanitized.spirit = {
            mode: 'flow',
            duration_minutes: duration,
            prescribed_reason:
              typeof block.spirit.prescribed_reason === 'string'
                ? block.spirit.prescribed_reason
                : healer.prescribed_reason,
            recovery_focus_zones:
              Array.isArray(block.spirit.recovery_focus_zones) &&
              block.spirit.recovery_focus_zones.length > 0
                ? block.spirit.recovery_focus_zones.map(String)
                : healer.required_recovery_zones,
            asanas,
          };
          sanitized.subtitle = `${asanas[0]!.name} · ${asanas.length} asanas`;
        }
      } else if (
        block.spirit.tempo_id &&
        tempoSet.has(block.spirit.tempo_id)
      ) {
        const tempo = SPIRIT_TEMPO_CATALOG.find((row) => row.id === block.spirit!.tempo_id)!;
        sanitized.spirit = {
          mode: 'breathwork',
          tempo_id: block.spirit.tempo_id,
          duration_minutes: Number(block.spirit.duration_minutes) || 15,
          prescribed_reason:
            typeof block.spirit.prescribed_reason === 'string'
              ? block.spirit.prescribed_reason
              : 'Spirit expert prescription',
          recovery_focus_zones: healer.required_recovery_zones,
        };
        sanitized.subtitle = `${tempo.name} · ${sanitized.spirit.duration_minutes} min`;
      }
    }

    const hasPayload =
      (sanitized.pillar === 'iron' && (sanitized.iron?.exercises?.length ?? 0) > 0) ||
      (sanitized.pillar === 'combat' && (sanitized.combat?.rounds?.length ?? 0) > 0) ||
      (sanitized.pillar === 'spirit' &&
        (Boolean(sanitized.spirit?.tempo_id) ||
          (sanitized.spirit?.asanas?.length ?? 0) > 0));

    return hasPayload ? [sanitized] : [];
  });
}

function buildExpertContext(
  focus: FocusPreference,
  equipment: string[],
  catalog: LibraryExercise[],
  routineIds: string[],
  comboCatalog: LibraryCombo[],
  allowedComboIds: string[],
  ironLogs3w: PerformanceLogRow[],
  ironLogs7d: PerformanceLogRow[],
  autoreg: IronAutoregulationState,
  mesocycle: MesocycleExerciseSummary[],
  weeklyVolume: WeeklyMuscleVolumeRow[],
  combatMastery: number,
  yesterdayMainRpe: number | null,
  yesterdayMainPillar: string | null,
  spiritEssence: number,
  flowCatalog: LibraryFlowSpiritRow[],
  allowedFlowIds: string[],
  healer: HealerRecoveryState,
  allowedSpiritTempoIds: string[],
) {
  const flowByZone: Record<string, LibraryFlowSpiritRow[]> = {};
  for (const row of flowCatalog.filter((item) => item.pillar === 'flow')) {
    for (const zone of row.target_recovery_zones) {
      if (!flowByZone[zone]) flowByZone[zone] = [];
      flowByZone[zone].push(row);
    }
  }

  const swapPool: Record<string, IronCatalogEntry[]> = {};
  for (const row of catalog) {
    if (!row.primary_muscle) continue;
    const key = row.primary_muscle;
    if (!swapPool[key]) swapPool[key] = [];
    swapPool[key].push(toCatalogEntry(row));
  }

  return {
    focus_preference: focus,
    available_equipment: equipment,
    iron_expert: {
      routine_id: 'iron_routine_a',
      routine_exercise_ids: routineIds,
      allowed_exercise_ids: catalog.map((row) => row.id),
      catalog_dictionary: buildCatalogDictionary(catalog),
      catalog_biomechanics: catalog.map((row) => toCatalogEntry(row)),
      mesocycle: {
        window_days: MESOCYCLE_DAYS,
        per_exercise: mesocycle,
      },
      autoregulation: autoreg,
      performance_history_3w: ironLogs3w,
      performance_history_7d: ironLogs7d,
      weekly_volume_7d: weeklyVolume,
      volume_rules: {
        mev_sets: HYPERTROPHY_MEV_SETS,
        mrv_soft: HYPERTROPHY_MRV_SOFT,
        mrv_hard: HYPERTROPHY_MRV_HARD,
        optimal_band: '10-20 working sets per primary_muscle per 7 days',
      },
      swap_pool_by_primary_muscle: swapPool,
    },
    combat_expert: {
      combat_mastery: combatMastery,
      max_complexity_for_user: maxComboComplexityForMastery(combatMastery),
      allowed_combo_ids: allowedComboIds,
      catalog: comboCatalog.filter((combo) => allowedComboIds.includes(combo.id)),
      tactical_focus_catalog: {
        footwork_range: {
          label: 'Footwork & Range',
          intent:
            'Boxing/Muay Thai range — jabs, teeps, pivots, slip exits; win distance before power.',
        },
        power_inside: {
          label: 'Power Inside',
          intent:
            'Close the gap — hooks, body shots, clinch knees/elbows; Muay inside ties.',
        },
        defense_counter: {
          label: 'Defense & Counter',
          intent:
            'Slip, roll, parry, check kick, high guard — counter only on clean reads.',
        },
        burnout: {
          label: 'Burnout Finisher',
          intent:
            'High-volume flurries with sprawls — shorter work intervals, technical decay allowed.',
        },
      },
      catalog_by_tactical_focus: Object.fromEntries(
        COMBAT_TACTICAL_FOCUS_VALUES.map((focus) => [
          focus,
          comboCatalog
            .filter(
              (combo) =>
                allowedComboIds.includes(combo.id) && combo.tactical_focus === focus,
            )
            .map((combo) => ({
              id: combo.id,
              slug: combo.slug,
              combo_name: combo.combo_name,
              complexity_level: combo.complexity_level,
              sequence: combo.sequence,
            })),
        ]),
      ),
    },
    spirit_expert: {
      spirit_essence: spiritEssence,
      max_complexity_tier: healer.max_complexity_tier,
      yesterday_main_rpe: yesterdayMainRpe,
      yesterday_main_pillar: yesterdayMainPillar,
      allowed_tempo_ids: allowedSpiritTempoIds,
      tempo_catalog: flowCatalog
        .filter((row) => row.pillar === 'spirit')
        .map((row) => ({
          id: SPIRIT_SLUG_TO_TEMPO_ID[row.slug] ?? row.slug,
          name: row.session_name,
          slug: row.slug,
          duration_minutes: row.duration_minutes,
          tempo_profile: row.tempo_profile,
        })),
      spirit_sessions_db: flowCatalog.filter((row) => row.pillar === 'spirit'),
      allowed_flow_ids: allowedFlowIds,
      flow_catalog: flowCatalog.filter((row) => allowedFlowIds.includes(row.id)),
      flow_catalog_by_zone: flowByZone,
      healer_48h: healer,
      prescription_rules: {
        iron_lower_body_requires_zones: [...LOWER_BODY_RECOVERY_ZONES],
        beginner_essence_max: SPIRIT_BEGINNER_ESSENCE_MAX,
      },
    },
  };
}

function buildFallbackProtocol(
  focus: FocusPreference,
  catalog: LibraryExercise[],
  routineIds: string[],
  ironLogs3w: PerformanceLogRow[],
  ironLogs7d: PerformanceLogRow[],
  autoreg: IronAutoregulationState,
  equipment: string[],
  comboCatalog: LibraryCombo[],
  allowedComboIds: string[],
  combatMastery: number,
  yesterdayRpe: number | null,
  biological: BiologicalPassport,
  flowCatalog: LibraryFlowSpiritRow[],
  allowedFlowIds: string[],
  healer: HealerRecoveryState,
): GameplanBlockPayload[] {
  const ranked = [
    { pillar: 'iron' as const, weight: focus.iron },
    { pillar: 'combat' as const, weight: focus.combat },
    { pillar: 'spirit' as const, weight: focus.spirit + focus.flow },
  ].sort((a, b) => b.weight - a.weight);

  const blocks: GameplanBlockPayload[] = [];
  let order = 0;

  const stressRpe =
    yesterdayRpe ?? (biological.baseline_stress_level != null ? biological.baseline_stress_level + 2 : null);

  if (focus.flow >= 15) {
    const morningFlow =
      buildFlowBlockFromHealer(
        flowCatalog,
        allowedFlowIds,
        healer,
        stressRpe,
        order,
        'block-morning-flow',
        'Morning Flow',
      ) ?? buildSpiritBlockFromRpe(stressRpe, order, 'block-morning-flow', 'Morning Flow');
    morningFlow.order = order++;
    blocks.push(morningFlow);
  }

  const main = ranked[0].pillar;
  if (main === 'iron' && routineIds.length > 0) {
    const iron = buildDeterministicIronBlock(
      'iron_routine_a',
      catalog,
      routineIds,
      ironLogs3w,
      ironLogs7d,
      biological.weight_kg,
      autoreg,
      equipment,
    );
    iron.order = order++;
    blocks.push(iron);
  } else if (main === 'combat') {
    const combat = buildDeterministicCombatBlock(
      comboCatalog.filter((combo) => allowedComboIds.includes(combo.id)),
      combatMastery,
      yesterdayRpe,
      biological.baseline_stress_level,
    );
    if (combat) {
      combat.order = order++;
      blocks.push(combat);
    }
  } else {
    const spiritMain =
      buildFlowBlockFromHealer(
        flowCatalog,
        allowedFlowIds,
        healer,
        stressRpe,
        order,
        'block-main-spirit',
        'Main Ritual: Flow & Spirit',
      ) ?? buildSpiritBlockFromRpe(stressRpe, order, 'block-main-spirit', 'Main Ritual: Spirit');
    spiritMain.order = order++;
    blocks.push(spiritMain);
  }

  if (blocks.length === 0) return FALLBACK_BLOCKS;
  return blocks;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(null, 204);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('[generate_daily_protocol] Handler start', { user_id: user.id });

    const body = await req.json();
    const focus_preference: FocusPreference = body.focus_preference;

    const catalogAssets = await fetchMandatoryCatalogAssets(
      supabase,
      user.id,
      body.available_equipment,
    );

    const available_equipment = catalogAssets.available_equipment;
    const exerciseCatalog = catalogAssets.exercises;
    const comboCatalog = catalogAssets.combat;
    const flowCatalog = catalogAssets.flow_spirit;
    const allowedSpiritTempoIds = catalogAssets.spirit_tempo_ids;
    const availableAssetsTag = buildAvailableAssetsTag(catalogAssets);

    if (catalogAssets.fetch_errors.length > 0) {
      console.warn(
        '[generate_daily_protocol] Catalog fetch partial errors:',
        catalogAssets.fetch_errors,
      );
    }

    if (exerciseCatalog.length === 0) {
      return jsonResponse(
        {
          error: 'INSUFFICIENT_CATALOG',
          message:
            'No library_exercises match user_environment.available_equipment. Update Foundation Scan equipment or apply seed_hypertrophy.sql.',
          catalog_counts: {
            library_exercises_total: catalogAssets.exercises_all.length,
            library_exercises_filtered: 0,
            library_combat: comboCatalog.length,
            library_flow_spirit: flowCatalog.length,
            available_equipment,
          },
        },
        422,
      );
    }

    if (comboCatalog.length === 0) {
      return jsonResponse(
        {
          error: 'INSUFFICIENT_CATALOG',
          message:
            'library_combat is empty. Run migrations 004/009 and seed_combat_tactical.sql before generating protocols.',
          catalog_counts: {
            library_exercises_filtered: exerciseCatalog.length,
            library_combat: 0,
          },
        },
        422,
      );
    }

    const protocolDate = new Date().toISOString().slice(0, 10);
    const mesocycleCutoff = new Date();
    mesocycleCutoff.setDate(mesocycleCutoff.getDate() - MESOCYCLE_DAYS);
    const mesocycleCutoffIso = mesocycleCutoff.toISOString();

    const [profileRes, statsRes, logsRes, lastProtocolRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'focus_preference, date_of_birth, weight_kg, height_cm, body_fat_percentage, current_injuries, baseline_stress_level',
        )
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_stats')
        .select('combat_mastery, spirit_essence')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('performance_logs')
        .select('pillar, exercise_id, weight_used, reps_completed, rpe_score, timestamp, payload')
        .eq('user_id', user.id)
        .gte('timestamp', mesocycleCutoffIso)
        .order('timestamp', { ascending: false })
        .limit(200),
      supabase
        .from('daily_protocols')
        .select('blocks')
        .eq('user_id', user.id)
        .order('protocol_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const biological = mapBiologicalPassport((profileRes.data as ProfileRow | null) ?? null);

    const combatMastery = statsRes.data?.combat_mastery ?? 0;
    const spiritEssence = statsRes.data?.spirit_essence ?? 0;
    const maxComplexity = maxComboComplexityForMastery(combatMastery);
    const allowedComboIds = comboCatalog
      .filter((combo) => combo.complexity_level <= maxComplexity)
      .map((combo) => combo.id);

    const maxFlowTier = maxComplexityTierForSpiritEssence(spiritEssence);
    const allowedFlowIds = flowCatalog
      .filter((row) => row.pillar === 'flow' && row.complexity_tier <= maxFlowTier)
      .map((row) => row.id);

    const performanceLogs: PerformanceLogRow[] = (logsRes.error ? [] : logsRes.data ?? []).map(
      (row) => ({
        pillar: row.pillar,
        exercise_id: row.exercise_id,
        weight_used: row.weight_used,
        reps_completed: row.reps_completed,
        rpe_score: row.rpe_score,
        timestamp: row.timestamp,
        payload: (row.payload as PerformanceLogRow['payload']) ?? null,
      }),
    );

    let lastIronExerciseIds: string[] | null = null;
    const lastBlocks = lastProtocolRes.data?.blocks;
    if (Array.isArray(lastBlocks)) {
      const ironBlock = lastBlocks.find(
        (block: { pillar?: string; iron?: { exercises?: { exercise_id: string }[] } }) =>
          block?.pillar === 'iron' && Array.isArray(block?.iron?.exercises),
      );
      if (ironBlock?.iron?.exercises) {
        lastIronExerciseIds = ironBlock.iron.exercises.map(
          (row: { exercise_id: string }) => row.exercise_id,
        );
      }
    }

    const mainLogs = performanceLogs.filter((log) =>
      ['iron', 'combat', 'spirit', 'flow'].includes(log.pillar),
    );
    const yesterdayMain = mainLogs[0] ?? null;
    const yesterdayMainRpe = yesterdayMain?.rpe_score ?? null;
    const yesterdayMainPillar = yesterdayMain?.pillar ?? null;

    const baseRoutineIds = resolveIronRoutineIds(exerciseCatalog, lastIronExerciseIds);
    const ironAutoreg = detectIronAutoregulation(biological, yesterdayMainRpe);
    const autoregulatedRoutineIds = applyIronRoutineAutoregulation(
      baseRoutineIds,
      exerciseCatalog,
      available_equipment,
      ironAutoreg,
    );

    const ironLogs3w = filterIronLogsLastDays(performanceLogs, MESOCYCLE_DAYS);
    const ironLogs7d = filterIronLogsLastDays(performanceLogs, WEEKLY_VOLUME_DAYS);
    const weeklyVolume = buildWeeklyVolumeByMuscle(exerciseCatalog, ironLogs7d);
    const mesocycleSummaries = buildMesocycleSummaries(
      autoregulatedRoutineIds,
      exerciseCatalog,
      ironLogs3w,
    );

    const healerState = analyzeHealerRecovery48h(
      performanceLogs,
      exerciseCatalog,
      spiritEssence,
    );

    const resolvedFlowIds =
      allowedFlowIds.length > 0
        ? allowedFlowIds
        : flowCatalog.filter((row) => row.pillar === 'flow').map((row) => row.id);

    let blocks: GameplanBlockPayload[] = buildFallbackProtocol(
      focus_preference,
      exerciseCatalog,
      autoregulatedRoutineIds,
      ironLogs3w,
      ironLogs7d,
      ironAutoreg,
      available_equipment,
      comboCatalog,
      allowedComboIds.length > 0 ? allowedComboIds : comboCatalog.map((combo) => combo.id),
      combatMastery,
      yesterdayMainRpe,
      biological,
      flowCatalog,
      resolvedFlowIds,
      healerState,
    );

    let source: 'ai' | 'fallback' | 'deterministic' = 'deterministic';

    if (openRouterKey && focus_preference && exerciseCatalog.length > 0) {
      const expertContext = buildExpertContext(
        focus_preference,
        available_equipment,
        exerciseCatalog,
        autoregulatedRoutineIds,
        comboCatalog,
        allowedComboIds.length > 0 ? allowedComboIds : comboCatalog.map((combo) => combo.id),
        ironLogs3w,
        ironLogs7d,
        ironAutoreg,
        mesocycleSummaries,
        weeklyVolume,
        combatMastery,
        yesterdayMainRpe,
        yesterdayMainPillar,
        spiritEssence,
        flowCatalog,
        resolvedFlowIds,
        healerState,
        allowedSpiritTempoIds,
      );

      const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://somma.app',
          'X-Title': 'SOMMA Longevity OS',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt(biological, availableAssetsTag) },
            {
              role: 'user',
              content: JSON.stringify({
                date: protocolDate,
                biological_passport: biological,
                expert_context: expertContext,
                catalog_counts: {
                  exercises: exerciseCatalog.length,
                  combat: comboCatalog.length,
                  flow: flowCatalog.filter((r) => r.pillar === 'flow').length,
                  spirit: flowCatalog.filter((r) => r.pillar === 'spirit').length,
                },
              }),
            },
          ],
        }),
      });

      if (llmRes.ok) {
        const llmJson = await llmRes.json();
        const content = llmJson?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content) as AiBlueprintResponse;
            if (parsed.error === 'INSUFFICIENT_CATALOG') {
              console.warn(
                '[generate_daily_protocol] LLM returned INSUFFICIENT_CATALOG:',
                parsed.message,
              );
            } else if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
              const sanitized = sanitizeBlueprint(
                parsed,
                autoregulatedRoutineIds,
                allowedComboIds.length > 0 ? allowedComboIds : comboCatalog.map((combo) => combo.id),
                allowedSpiritTempoIds,
                resolvedFlowIds,
                exerciseCatalog,
                comboCatalog,
                flowCatalog,
                healerState,
                available_equipment,
                ironAutoreg,
                weeklyVolume,
              );
              if (sanitized.length > 0) {
                blocks = sanitized;
                source = 'ai';
              }
            }
          } catch {
            // Keep deterministic fallback
          }
        }
      }
    } else if (!openRouterKey) {
      source = 'fallback';
    }

    await supabase.from('daily_protocols').upsert(
      {
        user_id: user.id,
        protocol_date: protocolDate,
        blocks,
        source,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,protocol_date' },
    );

    return jsonResponse({
      date: protocolDate,
      blocks: blocks.map((block) => ({ ...block, status: 'pending' })),
      generated_at: new Date().toISOString(),
      source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message, blocks: FALLBACK_BLOCKS }, 500);
  }
});
