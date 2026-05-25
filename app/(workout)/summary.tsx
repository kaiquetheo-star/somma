import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { completionFromParams } from '@/hooks/useWorkoutNavigation';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import { MICROCYCLE_DAY_LABELS } from '@/lib/gameplan/microcycleWeek';
import { useSommaStore } from '@/store/useSommaStore';

const MATTE_GOLD = '#BFA06A';

function MetricCard({
  label,
  value,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <View
      className={`overflow-hidden rounded-2xl border px-5 py-5 ${
        highlight
          ? 'border-matte-gold/45 bg-matte-gold/10'
          : 'border-white/10 bg-white/[0.03]'
      }`}
      style={
        highlight
          ? {
              shadowColor: MATTE_GOLD,
              shadowOpacity: 0.35,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
            }
          : undefined
      }
    >
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        {label}
      </Text>
      <Text
        className={`mt-2 font-display-bold text-3xl ${
          highlight ? 'text-matte-gold' : 'text-[#E8E4DC]'
        }`}
      >
        {value}
      </Text>
      {detail ? (
        <Text className="mt-2 font-body text-sm leading-5 text-[#8A9488]">{detail}</Text>
      ) : null}
    </View>
  );
}

/** Premium post-workout summary — shown when the daily protocol is fully complete */
export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    blockId?: string;
    pillar?: string;
    rpe?: string;
    volume?: string;
    exerciseId?: string;
    weightUsed?: string;
    repsCompleted?: string;
    restSeconds?: string;
  }>();

  const storeHydrated = useStoreHydrated();
  const summary = useSommaStore((state) => state.lastWorkoutSummary);
  const prepareWorkoutSummary = useSommaStore((state) => state.prepareWorkoutSummary);
  const completeWorkout = useSommaStore((state) => state.completeWorkout);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    void (async () => {
      try {
        const completion = completionFromParams(params);
        if (completion) {
          await completeWorkout(completion);
        }
      } catch {
        // Local queue retains the session for foreground flush
      }
      await prepareWorkoutSummary();
    })();
  }, [completeWorkout, params, prepareWorkoutSummary]);

  const dayLabel =
    summary != null
      ? (MICROCYCLE_DAY_LABELS[summary.day_index - 1] ?? `Day ${summary.day_index}`)
      : 'Today';

  if (!storeHydrated) {
    return <LoadingFallback message="Preparing session summary…" eyebrow="Ascension" />;
  }

  return (
    <View className="flex-1 bg-[#0A0E0C]">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-8 pb-12 pt-10"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-body text-[10px] uppercase tracking-[0.45em] text-matte-gold/75">
            Ascension complete
          </Text>
          <Text className="mt-4 font-display-bold text-3xl leading-tight text-[#E8E4DC]">
            {dayLabel} sealed
          </Text>
          {summary?.focus_label ? (
            <Text className="mt-2 font-body text-sm text-[#8A9488]">{summary.focus_label}</Text>
          ) : null}

          <View className="mt-10 gap-4">
            <MetricCard
              label="Total volume load"
              value={summary ? `${summary.total_volume_kg.toLocaleString()} kg` : '—'}
              detail="Mechanical work across Iron sets logged today"
            />
            <MetricCard
              label="CNS fatigue generated"
              value={summary ? String(summary.cns_fatigue_total) : '—'}
              detail="Sum of catalog CNS cost · Iron sets + Combat round complexity"
            />
            {(summary?.e1rm_unlocks?.length ?? 0) > 0 ? (
              (summary?.e1rm_unlocks ?? []).map((unlock) => (
                <MetricCard
                  key={unlock.exercise_id}
                  label="E1RM unlocked"
                  value={`${unlock.e1rm_kg} kg`}
                  detail={`${unlock.exercise_name}${
                    unlock.previous_best_kg != null
                      ? ` · previous best ${unlock.previous_best_kg} kg`
                      : ' · new baseline established'
                  }`}
                  highlight
                />
              ))
            ) : (
              <MetricCard
                label="E1RM unlocked"
                value="—"
                detail="No new estimated 1RM records today — keep building volume."
              />
            )}
          </View>

          <Pressable
            onPress={() => router.replace('/(tabs)/home')}
            accessibilityRole="button"
            accessibilityLabel="Return to Sanctuary"
            className="mt-12 overflow-hidden rounded-2xl border border-matte-gold/50 bg-matte-gold/15 px-8 py-5 active:opacity-85"
            style={{
              shadowColor: MATTE_GOLD,
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text className="text-center font-body-medium text-sm uppercase tracking-[0.35em] text-matte-gold">
              Return to Sanctuary
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
