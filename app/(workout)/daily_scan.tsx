import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingFallback } from '@/components/routing/LoadingFallback';
import { WORKOUT_ROUTES } from '@/constants/workout';
import { useStoreHydrated } from '@/hooks/useStoreHydrated';
import type { NutritionStatus } from '@/lib/physics/nutritionMath';
import type { GameplanBlock, WorkoutPillar } from '@/types/gameplan';
import { useSommaStore } from '@/store/useSommaStore';

const OBSIDIAN = '#0A0E0C';
const MATTE_GOLD = '#BFA06A';
const MUTED = '#6B7568';

const NUTRITION_OPTIONS: { id: NutritionStatus; label: string }[] = [
  { id: 'DEFICIT', label: 'DEFICIT' },
  { id: 'ON_TARGET', label: 'ON TARGET' },
  { id: 'SURPLUS', label: 'SURPLUS' },
];

/** Clinical Law II — subjective readiness gate before pillar workout */
export default function DailyReadinessScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    blockId?: string;
    title?: string;
    pillar?: string;
  }>();

  const hydrated = useStoreHydrated();
  const applySubjectiveReadiness = useSommaStore((state) => state.applySubjectiveReadiness);
  const applyNutritionStatus = useSommaStore((state) => state.applyNutritionStatus);
  const [score, setScore] = useState<number | null>(null);
  const [nutritionPick, setNutritionPick] = useState<NutritionStatus | null>(null);

  const pillar = params.pillar as WorkoutPillar | undefined;
  const route =
    pillar && pillar in WORKOUT_ROUTES
      ? WORKOUT_ROUTES[pillar]
      : null;

  const paramsValid = Boolean(params.blockId && route);

  useEffect(() => {
    if (!hydrated) return;
    if (!params.blockId || route) return;
    router.replace('/(tabs)/home');
  }, [hydrated, params.blockId, route, router]);

  const readinessHint = useMemo(() => {
    if (score == null) return null;
    if (score < 4) {
      return 'Autoregulation Mode — Combat removed · Iron loads −15%';
    }
    if (score >= 8) return 'High readiness — execute prescribed loads';
    return 'Standard protocol — proceed as prescribed';
  }, [score]);

  const onContinue = () => {
    if (score == null || !params.blockId || !route) return;
    applySubjectiveReadiness(score);
    if (nutritionPick) {
      applyNutritionStatus(nutritionPick);
    }
    router.replace({
      pathname: route,
      params: {
        blockId: params.blockId,
        title: params.title ?? '',
        pillar: pillar ?? '',
      },
    } as Href);
  };

  if (!hydrated) {
    return <LoadingFallback message="Restoring readiness state…" eyebrow="Clinical Readiness" />;
  }

  if (!paramsValid) {
    return (
      <LoadingFallback
        message="Invalid workout link — returning to Daily Command…"
        eyebrow="Clinical Readiness"
      />
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: OBSIDIAN }}>
      <View className="flex-1 justify-between px-10 py-12">
        <View>
          <Text
            className="font-body text-[10px] uppercase tracking-[0.45em]"
            style={{ color: MATTE_GOLD }}
          >
            Clinical Readiness
          </Text>
          <Text className="mt-4 font-display text-3xl text-white/95">Daily Scan</Text>
          <Text className="mt-3 font-body text-sm leading-6" style={{ color: MUTED }}>
            Subjective readiness (RPE / recovery). Honest input drives autoregulation — no API, no
            guesswork.
          </Text>
          {params.title ? (
            <Text className="mt-6 font-body text-xs uppercase tracking-[0.25em] text-white/50">
              Next · {params.title}
            </Text>
          ) : null}
        </View>

        <View className="gap-3">
          <Text className="text-center font-body text-[10px] uppercase tracking-[0.35em] text-white/40">
            Rate 1 (exhausted) — 10 (peak)
          </Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {Array.from({ length: 10 }, (_, index) => {
              const value = index + 1;
              const selected = score === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setScore(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Readiness ${value} of 10`}
                  className="items-center justify-center rounded-lg border active:opacity-80"
                  style={{
                    width: 52,
                    height: 52,
                    borderColor: selected ? MATTE_GOLD : 'rgba(255,255,255,0.12)',
                    backgroundColor: selected ? 'rgba(191,160,106,0.18)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <Text
                    className="font-display text-lg"
                    style={{ color: selected ? MATTE_GOLD : 'rgba(255,255,255,0.55)' }}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {readinessHint ? (
            <Text className="mt-2 text-center font-body text-xs leading-5" style={{ color: MATTE_GOLD }}>
              {readinessHint}
            </Text>
          ) : null}

          <View className="mt-6 gap-2">
            <Text className="text-center font-body text-[10px] uppercase tracking-[0.35em] text-white/40">
              Nutrition baseline yesterday
            </Text>
            <View className="flex-row justify-center gap-2">
              {NUTRITION_OPTIONS.map((opt) => {
                const selected = nutritionPick === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setNutritionPick(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Nutrition ${opt.label}`}
                    className="rounded-lg border px-4 py-3 active:opacity-80"
                    style={{
                      borderColor: selected ? MATTE_GOLD : 'rgba(255,255,255,0.12)',
                      backgroundColor: selected ? 'rgba(191,160,106,0.18)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <Text
                      className="font-body-medium text-[11px] uppercase tracking-[0.2em]"
                      style={{ color: selected ? MATTE_GOLD : 'rgba(255,255,255,0.55)' }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <Pressable
          onPress={onContinue}
          disabled={score == null}
          accessibilityRole="button"
          accessibilityState={{ disabled: score == null }}
          className="items-center rounded-xl border py-4 active:opacity-85"
          style={{
            borderColor: score != null ? MATTE_GOLD : 'rgba(255,255,255,0.1)',
            opacity: score != null ? 1 : 0.45,
          }}
        >
          <Text
            className="font-body text-xs uppercase tracking-[0.35em]"
            style={{ color: score != null ? MATTE_GOLD : MUTED }}
          >
            Enter Protocol
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
