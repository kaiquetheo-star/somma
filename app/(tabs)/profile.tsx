import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ValueStepper } from '@/components/iron/ValueStepper';
import { isSupabaseConfigured } from '@/lib/config';
import { upsertSteeringWheelSettings } from '@/lib/supabase/profile';
import { useAuth } from '@/providers/AuthProvider';
import { useSommaStore } from '@/store/useSommaStore';
import {
  clampPillarFrequency,
  deriveTrainingDaysFromFrequencies,
  inferTimeBudgetPresetId,
  PILLAR_FREQUENCY_MAX,
  PILLAR_FREQUENCY_MIN,
  TIME_BUDGET_PRESETS,
  timeBudgetFromPresetId,
  type BiologicalProfile,
  type TimeBudgetPresetId,
} from '@/types/biological';

const PILLAR_CONTROLS = [
  {
    key: 'frequency_iron' as const,
    label: 'Iron Frequency',
    unit: 'days / week',
    accent: 'text-[#E8E4DC]',
  },
  {
    key: 'frequency_combat' as const,
    label: 'Combat Frequency',
    unit: 'days / week',
    accent: 'text-matte-gold',
  },
  {
    key: 'frequency_spirit' as const,
    label: 'Spirit Frequency',
    unit: 'days / week',
    accent: 'text-[#A8B4A0]',
  },
];

/** Command Center — granular pillar frequencies & session time budget */
export default function ProfileScreen() {
  const { session, refreshRemoteProfile } = useAuth();
  const storedBiological = useSommaStore((state) => state.user_biological);
  const setUserBiological = useSommaStore((state) => state.setUserBiological);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);
  const gameplanLoading = useSommaStore((state) => state.gameplan_loading);

  const [draft, setDraft] = useState<BiologicalProfile>(storedBiological);
  const [timeBudgetId, setTimeBudgetId] = useState<TimeBudgetPresetId>('45');
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    setDraft(storedBiological);
    setTimeBudgetId(inferTimeBudgetPresetId(storedBiological));
  }, [storedBiological]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id) return;

    let mounted = true;
    setHydrating(true);
    void refreshRemoteProfile()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setHydrating(false);
      });

    return () => {
      mounted = false;
    };
  }, [session?.user?.id, refreshRemoteProfile]);

  const activeTrainingDays = useMemo(() => deriveTrainingDaysFromFrequencies(draft), [draft]);

  const hasChanges = useMemo(() => {
    const storedPreset = inferTimeBudgetPresetId(storedBiological);
  return (
      JSON.stringify({
        frequency_iron: draft.frequency_iron,
        frequency_combat: draft.frequency_combat,
        frequency_spirit: draft.frequency_spirit,
      }) !==
        JSON.stringify({
          frequency_iron: storedBiological.frequency_iron,
          frequency_combat: storedBiological.frequency_combat,
          frequency_spirit: storedBiological.frequency_spirit,
        }) || timeBudgetId !== storedPreset
    );
  }, [draft, storedBiological, timeBudgetId]);

  const patchFrequency = useCallback((key: keyof BiologicalProfile, value: number) => {
    setDraft((prev) => ({
      ...prev,
      [key]: clampPillarFrequency(value, 0),
    }));
  }, []);

  const handleTimeBudgetSelect = useCallback((presetId: TimeBudgetPresetId) => {
    setTimeBudgetId(presetId);
    const times = timeBudgetFromPresetId(presetId);
    setDraft((prev) => ({ ...prev, ...times }));
  }, []);

  const handleSaveAndRecalibrate = async () => {
    if (saving || gameplanLoading) return;

    const payload: BiologicalProfile = {
      ...storedBiological,
      ...draft,
      ...timeBudgetFromPresetId(timeBudgetId),
      training_days_per_week: deriveTrainingDaysFromFrequencies(draft),
    };

    setSaving(true);
    try {
      if (isSupabaseConfigured && session?.user?.id) {
        await upsertSteeringWheelSettings(session.user.id, payload);
      }

      setUserBiological(payload);
      await fetchDailyGameplanAsync({ forceRefresh: true });

      Alert.alert(
        'Neural link recalibrated',
        `Week rebuilt: Iron ${payload.frequency_iron}× · Combat ${payload.frequency_combat}× · Spirit ${payload.frequency_spirit}× (${activeTrainingDays} active days).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save steering settings.';
      Alert.alert('Recalibration failed', message);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || gameplanLoading;

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-8 pb-14 pt-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          Command Center
        </Text>
        <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">Steering Wheel</Text>
        <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
          Granular control over each pillar&apos;s weekly frequency and session time budget. Changes
          rebuild your 7-day microcycle immediately.
        </Text>

        {hydrating ? (
          <View className="mt-10 items-center py-8">
            <ActivityIndicator color="#BFA06A" />
          </View>
        ) : (
          <View className="mt-10 gap-10">
            <View className="rounded-2xl border border-white/10 bg-[#0A0E0C] px-5 py-6">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Weekly pillar frequency
              </Text>
              <Text className="mt-2 font-body text-xs text-[#8A9488]">
                Active training days this week:{' '}
                <Text className="text-matte-gold">{activeTrainingDays}</Text>
              </Text>

              <View className="mt-8 gap-10">
                {PILLAR_CONTROLS.map((pillar) => (
                  <View key={pillar.key} className="border-b border-white/5 pb-8 last:border-b-0">
                    <ValueStepper
                      label={pillar.label}
                      value={draft[pillar.key] ?? 0}
                      unit={pillar.unit}
                      step={1}
                      min={PILLAR_FREQUENCY_MIN}
                      max={PILLAR_FREQUENCY_MAX}
                      onChange={(value) => patchFrequency(pillar.key, value)}
                      disabled={busy}
                    />
                  </View>
                ))}
              </View>
            </View>

            <View className="gap-4">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Time budget
              </Text>
              <Text className="font-body text-xs leading-5 text-[#8A9488]">
                Scales Iron, Combat, and Spirit session lengths for the Head Coach.
              </Text>
              <View className="mt-2 flex-row flex-wrap gap-3">
                {TIME_BUDGET_PRESETS.map((preset) => {
                  const selected = timeBudgetId === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handleTimeBudgetSelect(preset.id)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      className={`rounded-xl border px-4 py-3 active:opacity-80 ${
                        selected
                          ? 'border-matte-gold/50 bg-matte-gold/15'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <Text
                        className={`font-body-medium text-xs uppercase tracking-[0.2em] ${
                          selected ? 'text-matte-gold' : 'text-[#8A9488]'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={handleSaveAndRecalibrate}
              disabled={busy}
              className={`overflow-hidden rounded-2xl border px-6 py-5 ${
                busy
                  ? 'border-matte-gold/20 bg-matte-gold/5 opacity-70'
                  : 'border-matte-gold/50 bg-matte-gold/15 active:opacity-85'
              }`}
            >
              {busy ? (
                <View className="flex-row items-center justify-center gap-3">
                  <ActivityIndicator color="#BFA06A" size="small" />
                  <Text className="font-body-medium text-xs uppercase tracking-[0.28em] text-matte-gold">
                    Recalibrating neural link…
                  </Text>
                </View>
              ) : (
                <Text className="text-center font-display-bold text-sm uppercase tracking-[0.22em] text-matte-gold">
                  Save & Recalibrate Neural Link
                </Text>
              )}
            </Pressable>

            {!hasChanges && !busy ? (
              <Text className="text-center font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
                Settings synced with Head Coach
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
