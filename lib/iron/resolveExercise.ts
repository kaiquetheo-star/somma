import { computeRestSecondsFromCns } from '@/types/catalog';
import type { IronExercisePrescription } from '@/types/gameplan';
import type { LibraryExercise } from '@/lib/catalog/library';

export interface ResolvedIronExerciseView {
  exercise_id: string;
  alternative_exercise_id: string | null;
  name: string;
  instructions: Record<string, string>;
  target_sets: number;
  target_reps: number;
  target_rep_range: string;
  target_rir: number;
  execution_technique: string;
  target_weight_kg: number;
  progression_note?: string;
  rest_seconds: number;
  primary_muscle: string | null;
}

interface ResolveOptions {
  prescription: IronExercisePrescription;
  library: LibraryExercise | null;
  fallbackName: string;
  fallbackWeight: number;
  fallbackReps: number;
  fallbackSets: number;
  exerciseIdOverride?: string;
  libraryCatalog: LibraryExercise[];
}

export function resolveIronExerciseView(options: ResolveOptions): ResolvedIronExerciseView {
  const {
    prescription,
    library: initialLibrary,
    fallbackName,
    fallbackWeight,
    fallbackReps,
    fallbackSets,
    exerciseIdOverride,
    libraryCatalog,
  } = options;

  const exerciseId = exerciseIdOverride ?? prescription.exercise_id;
  const library =
    libraryCatalog.find((row) => row.id === exerciseId) ?? initialLibrary;
  const rir = prescription.target_rir ?? 2;
  const cns = library?.cns_fatigue_cost ?? null;

  return {
    exercise_id: exerciseId,
    alternative_exercise_id: prescription.alternative_exercise_id ?? null,
    name: prescription.display_name ?? library?.name ?? fallbackName,
    instructions: library?.biomechanical_instructions ?? {},
    target_sets: prescription.target_sets ?? fallbackSets,
    target_reps: prescription.target_reps ?? fallbackReps,
    target_rep_range:
      prescription.target_rep_range ??
      `${Math.max(6, (prescription.target_reps ?? fallbackReps) - 2)}-${prescription.target_reps ?? fallbackReps} @ ${rir} RIR`,
    target_rir: rir,
    execution_technique: prescription.execution_technique ?? 'Standard',
    target_weight_kg: prescription.target_weight_kg ?? fallbackWeight,
    progression_note: prescription.progression_note,
    rest_seconds:
      prescription.rest_seconds ??
      computeRestSecondsFromCns(cns),
    primary_muscle: library?.primary_muscle ?? null,
  };
}
