import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { ExerciseCueCard } from '@/components/iron/ExerciseCueCard';
import { RestTimerOverlay } from '@/components/iron/RestTimerOverlay';
import { ValueStepper } from '@/components/iron/ValueStepper';
import { WorkoutShell } from '@/components/workout/WorkoutShell';
import {
  resolveIronExercise,
  type IronExerciseTemplate,
} from '@/constants/iron-exercises';
import { useActiveGameplanBlock } from '@/hooks/useActiveGameplanBlock';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { useRestTimer } from '@/hooks/useRestTimer';
import {
  fetchLibraryExercises,
  getExerciseById,
  type LibraryExercise,
} from '@/lib/catalog/library';
import { resolveIronExerciseView } from '@/lib/iron/resolveExercise';
import { hapticSetLogged } from '@/lib/haptics';
import type { IronExerciseBiomechanics } from '@/types/catalog';
import type { IronExercisePrescription } from '@/types/gameplan';
import type { IronSetLog } from '@/types/performance';
import { useSommaStore } from '@/store/useSommaStore';

type IronPhase = 'lifting' | 'resting' | 'done';

const DEFAULT_REST_SECONDS = 90;

function biomechanicsFromLibrary(library: LibraryExercise | null): IronExerciseBiomechanics | null {
  if (!library?.primary_muscle && library?.cns_fatigue_cost == null) return null;
  return {
    primary_muscle: library.primary_muscle,
    synergist_muscles: library.synergist_muscles,
    cns_fatigue_cost: library.cns_fatigue_cost,
    joint_stress_profile: library.joint_stress_profile,
    stretch_mediated_hypertrophy: library.stretch_mediated_hypertrophy,
  };
}

function stubPrescriptionFromTemplate(template: IronExerciseTemplate): IronExercisePrescription {
  return {
    exercise_id: template.id,
    target_sets: template.total_sets,
    target_reps: template.target_reps,
    target_weight_kg: template.target_weight_kg,
    target_rep_range: `${template.target_reps - 2}-${template.target_reps} @ 2 RIR`,
    target_rir: 2,
    rest_seconds: template.rest_seconds,
    alternative_exercise_id: null,
  };
}

export default function IronModeScreen() {
  const { blockId, title } = useLocalSearchParams<{ blockId?: string; title?: string }>();
  const activeBlock = useActiveGameplanBlock(blockId);
  const { finishBlock } = useWorkoutNavigation();
  const equipment = useSommaStore((state) => state.user_environment.available_equipment);
  const appendIronSession = useSommaStore((state) => state.appendIronSession);

  const localFallback = useMemo(() => resolveIronExercise(equipment), [equipment]);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalog, setCatalog] = useState<LibraryExercise[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [adaptedOverrideByIndex, setAdaptedOverrideByIndex] = useState<Record<number, string>>(
    {},
  );
  const [currentSet, setCurrentSet] = useState(1);
  const [weight, setWeight] = useState(localFallback.target_weight_kg);
  const [reps, setReps] = useState(localFallback.target_reps);
  const [logs, setLogs] = useState<IronSetLog[]>([]);
  const [phase, setPhase] = useState<IronPhase>('lifting');
  const [restBeforeSet, setRestBeforeSet] = useState(0);
  const [allExerciseLogs, setAllExerciseLogs] = useState<
    { exercise_id: string; exercise_name: string; sets: IronSetLog[] }[]
  >([]);

  const resolvedBlockId = blockId ?? 'block-main-iron';
  const prescriptions = activeBlock?.iron?.exercises;

  const exerciseQueue = useMemo(() => {
    if (!prescriptions?.length) {
      return [
        resolveIronExerciseView({
          prescription: stubPrescriptionFromTemplate(localFallback),
          library: null,
          fallbackName: localFallback.name,
          fallbackWeight: localFallback.target_weight_kg,
          fallbackReps: localFallback.target_reps,
          fallbackSets: localFallback.total_sets,
          libraryCatalog: catalog,
        }),
      ];
    }

    return prescriptions.map((prescription, index) => {
      const overrideId = adaptedOverrideByIndex[index];
      const activeId = overrideId ?? prescription.exercise_id;
      const libraryRow = getExerciseById(catalog, activeId);
      return resolveIronExerciseView({
        prescription,
        library: libraryRow,
        fallbackName: localFallback.name,
        fallbackWeight: prescription.target_weight_kg ?? localFallback.target_weight_kg,
        fallbackReps: prescription.target_reps,
        fallbackSets: prescription.target_sets,
        exerciseIdOverride: overrideId,
        libraryCatalog: catalog,
      });
    });
  }, [
    prescriptions,
    catalog,
    localFallback,
    adaptedOverrideByIndex,
  ]);

  const exercise = exerciseQueue[exerciseIndex] ?? exerciseQueue[0];
  const activeLibrary = useMemo(
    () => getExerciseById(catalog, exercise?.exercise_id ?? ''),
    [catalog, exercise?.exercise_id],
  );
  const totalSets = exercise?.target_sets ?? 4;
  const isBodyweight = (exercise?.target_weight_kg ?? weight) <= 0;
  const canAdapt =
    Boolean(exercise?.alternative_exercise_id) &&
    exercise.alternative_exercise_id !== exercise.exercise_id;

  useEffect(() => {
    let mounted = true;
    void fetchLibraryExercises()
      .then((rows) => {
        if (mounted) setCatalog(rows);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!exercise) return;
    setWeight(exercise.target_weight_kg);
    setReps(exercise.target_reps);
    setCurrentSet(1);
    setLogs([]);
    setPhase('lifting');
    setRestBeforeSet(0);
  }, [exercise?.exercise_id, exerciseIndex]);

  const onRestComplete = useCallback(() => {
    if (!exercise) return;
    setRestBeforeSet(exercise.rest_seconds);
    if (currentSet >= totalSets) {
      setPhase('done');
      return;
    }
    setCurrentSet((s) => s + 1);
    setPhase('lifting');
  }, [currentSet, totalSets, exercise]);

  const { remaining, isActive, start, skip } = useRestTimer({ onComplete: onRestComplete });

  const handleAdapt = () => {
    const altId = exercise?.alternative_exercise_id;
    if (!altId || altId === exercise.exercise_id) {
      Alert.alert(
        'No alternative',
        'This movement has no pre-mapped swap in today's protocol. Recalibrate to refresh options.',
      );
      return;
    }

    const altLibrary = getExerciseById(catalog, altId);
    if (!altLibrary) {
      Alert.alert('Catalog loading', 'Exercise encyclopedia not ready — try again in a moment.');
      return;
    }

    setAdaptedOverrideByIndex((prev) => ({ ...prev, [exerciseIndex]: altId }));
    setWeight(
      prescriptions?.[exerciseIndex]?.target_weight_kg ?? localFallback.target_weight_kg,
    );
    setReps(prescriptions?.[exerciseIndex]?.target_reps ?? localFallback.target_reps);
    setCurrentSet(1);
    setLogs([]);
    setPhase('lifting');
    setRestBeforeSet(0);
    skip();
  };

  const handleSkipRest = () => {
    if (!exercise) return;
    setRestBeforeSet(Math.max(0, exercise.rest_seconds - remaining));
    skip();
  };

  const handleLogSet = async () => {
    if (!exercise) return;

    const entry: IronSetLog = {
      set_index: currentSet,
      weight_kg: weight,
      reps,
      target_reps: exercise.target_reps,
      rest_seconds_used: restBeforeSet,
      logged_at: new Date().toISOString(),
    };
    setRestBeforeSet(0);

    setLogs((prev) => [...prev, entry]);
    await hapticSetLogged();

    if (currentSet >= totalSets) {
      setPhase('done');
      return;
    }

    setPhase('resting');
    start(exercise.rest_seconds);
  };

  const advanceToNextExercise = () => {
    if (!exercise) return;

    setAllExerciseLogs((prev) => [
      ...prev,
      {
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.name,
        sets: logs,
      },
    ]);

    if (exerciseIndex < exerciseQueue.length - 1) {
      setExerciseIndex((index) => index + 1);
      return;
    }

    handleCompleteRitual([
      ...allExerciseLogs,
      { exercise_id: exercise.exercise_id, exercise_name: exercise.name, sets: logs },
    ]);
  };

  const handleCompleteRitual = (
    completedExercises = allExerciseLogs,
  ) => {
    const lastExercise = completedExercises[completedExercises.length - 1];
    const lastSet = lastExercise?.sets[lastExercise.sets.length - 1];

    appendIronSession({
      block_id: resolvedBlockId,
      exercise_id: lastExercise?.exercise_id ?? exercise?.exercise_id ?? localFallback.id,
      exercise_name: lastExercise?.exercise_name ?? exercise?.name ?? localFallback.name,
      sets: lastExercise?.sets ?? logs,
      completed_at: new Date().toISOString(),
    });

    finishBlock(resolvedBlockId, {
      pillar: 'iron',
      exercise_id: lastExercise?.exercise_id ?? exercise?.exercise_id ?? null,
      weight_used: lastSet?.weight_kg ?? null,
      reps_completed: (lastExercise?.sets ?? logs).reduce((sum, set) => sum + set.reps, 0),
      volume: completedExercises.reduce(
        (sum, entry) => sum + entry.sets.reduce((inner, set) => inner + set.reps, 0),
        0,
      ),
      actual_rest_seconds: lastSet?.rest_seconds_used ?? null,
    });
  };

  const canLogSet = phase === 'lifting';
  const canCompleteExercise = phase === 'done' && logs.length >= totalSets;
  const isLastExercise = exerciseIndex >= exerciseQueue.length - 1;
  const canCompleteRitual = canCompleteExercise && isLastExercise;
  const canAdvanceExercise = canCompleteExercise && !isLastExercise;

  if (catalogLoading && activeBlock?.iron?.exercises?.length) {
    return (
      <WorkoutShell eyebrow="Iron · Strength" title={title ?? 'Iron Mode'} accent="obsidian">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#BFA06A" />
          <Text className="mt-4 font-body text-sm text-[#8A9488]">Loading encyclopedia…</Text>
        </View>
      </WorkoutShell>
    );
  }

  return (
    <WorkoutShell
      eyebrow="Iron · Strength"
      title={title ?? 'Iron Mode'}
      accent="obsidian"
      onComplete={
        canCompleteRitual
          ? () => handleCompleteRitual()
          : canAdvanceExercise
            ? advanceToNextExercise
            : undefined
      }
      completeDisabled={!canCompleteRitual && !canAdvanceExercise}
      completeLabel={
        canCompleteRitual
          ? 'Complete Ritual'
          : canAdvanceExercise
            ? `Next movement · ${exerciseIndex + 2} of ${exerciseQueue.length}`
            : `Log ${totalSets} sets to finish`
      }
    >
      <View className="relative flex-1">
        {isActive ? (
          <RestTimerOverlay
            remaining={remaining}
            total={exercise?.rest_seconds ?? DEFAULT_REST_SECONDS}
            onSkip={handleSkipRest}
          />
        ) : null}

        {/*
          Iterate over the ENTIRE exerciseQueue so the user can scroll through the
          full routine. Each exercise gets its own ExerciseCueCard. The current
          exercise also exposes the set-logging controls.
        */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName={`gap-6 ${canLogSet ? 'pb-24' : 'pb-4'}`}
        >
          {exerciseQueue.map((exItem, idx) => {
            const isCurrent = idx === exerciseIndex;
            const isPast = idx < exerciseIndex;
            const exLib = getExerciseById(catalog, exItem.exercise_id);
            const exBiomechanics = biomechanicsFromLibrary(exLib);
            const exCanAdapt =
              isCurrent &&
              Boolean(exItem.alternative_exercise_id) &&
              exItem.alternative_exercise_id !== exItem.exercise_id;

            return (
              <View
                key={`${exItem.exercise_id}-${idx}`}
                className={`overflow-hidden rounded-2xl border ${
                  isCurrent
                    ? 'border-matte-gold/20 bg-white/[0.05]'
                    : isPast
                      ? 'border-white/[0.05] bg-white/[0.02] opacity-50'
                      : 'border-white/[0.07] bg-white/[0.02]'
                }`}
              >
                {/* Exercise header */}
                <View className="px-5 py-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                        {exerciseQueue.length > 1
                          ? `Movement ${idx + 1} of ${exerciseQueue.length}`
                          : 'Prescribed movement'}
                        {isPast ? ' · Done' : ''}
                      </Text>
                      <Text
                        className={`font-display text-xl ${
                          isCurrent ? 'text-[#E8E4DC]' : 'text-[#6B7568]'
                        }`}
                      >
                        {exItem.name}
                      </Text>
                      <Text className="mt-2 font-body text-sm text-[#8A9488]">
                        {exItem.target_rep_range}
                      </Text>
                      {isCurrent ? (
                        <Text className="mt-1 font-body text-[10px] uppercase tracking-[0.25em] text-[#6B7568]">
                          Set {Math.min(currentSet, totalSets)} of {totalSets}
                          {exItem.execution_technique
                            ? ` · ${exItem.execution_technique}`
                            : ''}
                          {` · Rest ${exItem.rest_seconds ?? DEFAULT_REST_SECONDS}s`}
                          {phase === 'done' ? ' · Ready to advance' : ''}
                        </Text>
                      ) : null}
                    </View>

                    {isCurrent ? (
                      <Pressable
                        onPress={handleAdapt}
                        disabled={phase === 'resting' || !canAdapt}
                        className={`rounded-xl border px-3 py-2 active:opacity-80 ${
                          canAdapt
                            ? 'border-matte-gold/30 bg-matte-gold/10'
                            : 'border-white/10 bg-white/5 opacity-40'
                        }`}
                      >
                        <Text className="font-body text-[10px] uppercase tracking-[0.2em] text-matte-gold">
                          Adapt
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {isCurrent && canAdapt && activeLibrary ? (
                    <Text className="mt-3 font-body text-xs text-[#6B7568]">
                      Swap ready ·{' '}
                      {getExerciseById(catalog, exercise.alternative_exercise_id!)?.name ??
                        'alternative'}
                    </Text>
                  ) : null}
                </View>

                {/* ExerciseCueCard rendered for every exercise in the routine */}
                <ExerciseCueCard
                  instructions={exItem.instructions ?? {}}
                  progressionNote={exItem.progression_note}
                  biomechanics={exBiomechanics}
                />

                {/* Set-logging controls are scoped to the current active exercise */}
                {isCurrent ? (
                  <View className="gap-4 px-5 pb-5 pt-2">
                    <ValueStepper
                      label="Load"
                      value={weight}
                      unit={isBodyweight ? 'BW' : 'kg'}
                      step={isBodyweight ? 0 : 2.5}
                      min={0}
                      max={300}
                      onChange={setWeight}
                      disabled={!canLogSet}
                    />

                    <ValueStepper
                      label="Reps"
                      value={reps}
                      step={1}
                      min={1}
                      max={50}
                      onChange={setReps}
                      disabled={!canLogSet}
                    />

                    {logs.length > 0 ? (
                      <View className="gap-2">
                        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                          Logged sets
                        </Text>
                        {logs.map((log) => (
                          <View
                            key={`${log.set_index}-${log.logged_at}`}
                            className="flex-row justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3"
                          >
                            <Text className="font-body text-sm text-[#8A9488]">
                              Set {log.set_index}
                            </Text>
                            <Text className="font-body-medium text-sm text-[#E8E4DC]">
                              {log.weight_kg > 0 ? `${log.weight_kg} kg` : 'BW'} × {log.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {canLogSet ? (
          <Pressable
            onPress={handleLogSet}
            className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-2xl border border-matte-gold/50 bg-matte-gold/15 px-8 py-5 active:opacity-80"
          >
            <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
              Log Set {currentSet}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </WorkoutShell>
  );
}
