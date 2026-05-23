import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttunementOrbsPanel } from '@/components/sanctuary/AttunementOrbsPanel';
import { GameplanBlockCard } from '@/components/sanctuary/GameplanBlockCard';
import { WeeklyMicrocycleStrip } from '@/components/sanctuary/WeeklyMicrocycleStrip';
import { useUserStatsRealtime } from '@/hooks/useUserStatsRealtime';
import { useWorkoutNavigation } from '@/hooks/useWorkoutNavigation';
import { prefetchLibraryCatalogs } from '@/lib/catalog/library';
import { isProtocolDateStale } from '@/lib/gameplan/generateStubGameplan';
import { getTodayDayIndex, MICROCYCLE_DAY_LABELS } from '@/lib/gameplan/microcycleWeek';
import { useAuth } from '@/providers/AuthProvider';
import {
  getMicrocycleDay,
  getTodayBlocksFromStore,
  hasCompletedFoundationScan,
  useSommaStore,
} from '@/store/useSommaStore';
import type { DailyGameplan } from '@/types/gameplan';

/** The Daily Command — Sanctuary hub (FSD §3.2) */
export default function DailyCommandScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userStats = useSommaStore((state) => state.user_stats);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userBiological = useSommaStore((state) => state.user_biological);
  const weeklyMicrocycle = useSommaStore((state) => state.weeklyMicrocycle);
  const protocolDate = useSommaStore((state) => state.protocolDate);
  const weekStartDate = useSommaStore((state) => state.weekStartDate);
  const protocolGeneratedAt = useSommaStore((state) => state.protocolGeneratedAt);
  const selectedDayIndex = useSommaStore((state) => state.selectedDayIndex);
  const setSelectedDayIndex = useSommaStore((state) => state.setSelectedDayIndex);
  const gameplanLoading = useSommaStore((state) => state.gameplan_loading);
  const gameplanSource = useSommaStore((state) => state.gameplan_source);
  const gameplanError = useSommaStore((state) => state.gameplan_error);
  const clearGameplanError = useSommaStore((state) => state.clearGameplanError);
  const performanceSyncing = useSommaStore((state) => state.performance_syncing);
  const ensureDailyGameplan = useSommaStore((state) => state.ensureDailyGameplan);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);
  const regenerateDailyGameplan = useSommaStore((state) => state.regenerateDailyGameplan);

  const { openBlock } = useWorkoutNavigation();

  useUserStatsRealtime(user?.id);

  const todayDayIndex = getTodayDayIndex(weekStartDate);
  const selectedDay = getMicrocycleDay(weeklyMicrocycle, selectedDayIndex);

  const todayGameplanForOrbs = useMemo((): DailyGameplan | null => {
    if (!weeklyMicrocycle || !protocolDate) return null;
    return {
      date: protocolDate,
      week_start_date: weekStartDate ?? undefined,
      microcycle: weeklyMicrocycle,
      blocks: getTodayBlocksFromStore({ weeklyMicrocycle, weekStartDate }),
      generated_at: protocolGeneratedAt ?? new Date().toISOString(),
    };
  }, [weeklyMicrocycle, protocolDate, weekStartDate, protocolGeneratedAt]);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    if (!foundationComplete) return;

    if (isProtocolDateStale(protocolDate) || !weeklyMicrocycle) {
      fetchDailyGameplanAsync();
      return;
    }

    ensureDailyGameplan();
  }, [
    foundationComplete,
    protocolDate,
    weeklyMicrocycle,
    ensureDailyGameplan,
    fetchDailyGameplanAsync,
  ]);

  useEffect(() => {
    if (!foundationComplete) return;
    void prefetchLibraryCatalogs();
  }, [foundationComplete]);

  const completedCount =
    selectedDay?.blocks.filter((block) => block.status === 'completed').length ?? 0;
  const totalCount = selectedDay?.blocks.length ?? 0;

  const selectedDayLabel = MICROCYCLE_DAY_LABELS[selectedDayIndex - 1] ?? 'Day';
  const protocolHeading =
    selectedDayIndex === todayDayIndex
      ? "Today's protocol"
      : `${selectedDayLabel}'s protocol`;

  const sourceLabel =
    gameplanSource === 'ai'
      ? 'AI protocol'
      : gameplanSource === 'deterministic'
        ? 'Expert protocol'
        : gameplanSource === 'fallback'
          ? 'Fallback protocol'
          : gameplanSource === 'stub'
            ? 'Local protocol'
            : null;

  return (
    <SafeAreaView className="flex-1 bg-[#0F1512]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-8 pb-12 pt-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          The Sanctuary
        </Text>
        <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">Daily Command</Text>

        <View className="mt-8 items-center">
          <AttunementOrbsPanel
            stats={userStats}
            biological={userBiological}
            gameplan={todayGameplanForOrbs}
          />
        </View>

        {foundationComplete ? (
          <>
            <WeeklyMicrocycleStrip
              microcycle={weeklyMicrocycle}
              selectedDayIndex={selectedDayIndex}
              todayDayIndex={todayDayIndex}
              onSelectDay={setSelectedDayIndex}
            />

            <View className="mt-10 gap-3">
              <View className="flex-row items-end justify-between">
                <View className="flex-1 pr-4">
                  <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                    {protocolHeading}
                  </Text>
                  {selectedDay?.focus_label ? (
                    <Text className="mt-1 font-body text-xs text-[#8A9488]">
                      {selectedDay.focus_label}
                    </Text>
                  ) : null}
                </View>
                {gameplanLoading || performanceSyncing ? (
                  <ActivityIndicator size="small" color="#BFA06A" />
                ) : (
                  <Text className="font-body text-xs text-matte-gold/80">
                    {selectedDay?.is_rest_day
                      ? 'Recovery'
                      : `${completedCount}/${totalCount} complete`}
                    {sourceLabel && selectedDayIndex === todayDayIndex
                      ? ` · ${sourceLabel}`
                      : ''}
                  </Text>
                )}
              </View>

              {performanceSyncing ? (
                <View className="overflow-hidden rounded-2xl border border-matte-gold/20 bg-matte-gold/5 px-5 py-3">
                  <Text className="font-body text-xs text-matte-gold/90">
                    Integrating session · recalibrating protocol…
                  </Text>
                </View>
              ) : null}

              {gameplanError ? (
                <View className="overflow-hidden rounded-3xl border border-red-500/35 bg-red-950/30 px-6 py-8">
                  <Text className="text-center font-body text-[10px] uppercase tracking-[0.35em] text-red-400/90">
                    Neural Link Failed
                  </Text>
                  <Text className="mt-4 text-center font-display text-xl leading-8 text-[#E8C4C4]">
                    Head Coach could not reach the clinic.
                  </Text>
                  <Text className="mt-2 text-center font-body text-sm leading-6 text-[#B89090]">
                    {gameplanError}
                  </Text>
                  <Pressable
                    onPress={() => {
                      clearGameplanError();
                      void regenerateDailyGameplan();
                    }}
                    disabled={gameplanLoading || performanceSyncing}
                    accessibilityRole="button"
                    accessibilityLabel="Retry neural link"
                    className="mt-6 overflow-hidden rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-4 active:opacity-80"
                  >
                    <Text className="text-center font-body-medium text-xs uppercase tracking-[0.3em] text-red-300">
                      Re-establish link
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {gameplanLoading && !weeklyMicrocycle && !gameplanError ? (
                <View className="items-center py-12">
                  <Text className="font-body text-sm text-[#8A9488]">
                    Experts are arranging your ritual…
                  </Text>
                </View>
              ) : null}

              {!gameplanError && selectedDay?.is_rest_day ? (
                <View className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] px-6 py-10">
                  <Text className="text-center font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                    Recovery phase
                  </Text>
                  <Text className="mt-4 text-center font-display text-xl leading-8 text-[#C8C4BC]">
                    Biochemical Recovery Phase.
                  </Text>
                  <Text className="mt-2 text-center font-body text-sm leading-6 text-[#8A9488]">
                    No intense protocols scheduled.
                  </Text>
                </View>
              ) : !gameplanError && selectedDay
                ? selectedDay.blocks
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((block) => (
                      <GameplanBlockCard
                        key={block.id}
                        block={block}
                        onPress={() => openBlock(block)}
                      />
                    ))
                : null}

              <Pressable
                onPress={() => regenerateDailyGameplan()}
                disabled={gameplanLoading || performanceSyncing}
                accessibilityRole="button"
                accessibilityLabel="Recalibrate weekly protocol"
                className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-5 py-4 active:opacity-80"
              >
                <Text className="font-body-medium text-xs uppercase tracking-[0.3em] text-[#8A9488]">
                  Recalibrate
                </Text>
                <Text className="mt-1 font-body text-xs text-[#6B7568]">
                  Invoke AI Edge Function · refresh this week&apos;s microcycle
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            onPress={() => router.push('/(auth)/foundation')}
            accessibilityRole="button"
            accessibilityLabel="Begin Foundation Scan"
            className="mt-10 overflow-hidden rounded-2xl border border-matte-gold/25 bg-white/5 px-5 py-4 active:opacity-75"
          >
            <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-matte-gold/80">
              Protocol awaiting
            </Text>
            <Text className="mt-2 font-display text-xl text-[#E8E4DC]">
              Complete your Foundation Scan
            </Text>
            <Text className="mt-2 font-body text-sm leading-6 text-[#8A9488]">
              Your AI-curated blocks will appear here once attunement is established.
            </Text>
            <Text className="mt-4 font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
              Begin Foundation Scan →
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
