import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BiologicalPassportForm } from '@/components/foundation/BiologicalPassportForm';
import { FoundationProgress } from '@/components/foundation/FoundationProgress';
import { SelectionTile } from '@/components/foundation/SelectionTile';
import {
  EQUIPMENT_OPTIONS,
  FOUNDATION_STEP_META,
  FOUNDATION_STEPS,
  PILLAR_OPTIONS,
  type FoundationStep,
} from '@/constants/foundation';
import { isSupabaseConfigured } from '@/lib/config';
import { syncFoundationToSupabase } from '@/lib/supabase/profile';
import { useAuth } from '@/providers/AuthProvider';
import type { BiologicalProfile } from '@/types/biological';
import { initialBiologicalProfile, isBiologicalProfileComplete } from '@/types/biological';
import type { EquipmentTag, FocusPreference, PillarId } from '@/store/useSommaStore';
import { useSommaStore } from '@/store/useSommaStore';

export default function FoundationScanScreen() {
  const router = useRouter();
  const { user, isConfigured, isLoading } = useAuth();
  const completeFoundationScan = useSommaStore((state) => state.completeFoundationScan);
  const fetchDailyGameplanAsync = useSommaStore((state) => state.fetchDailyGameplanAsync);

  useEffect(() => {
    if (isConfigured && !isLoading && !user) {
      router.replace('/(auth)');
    }
  }, [isConfigured, isLoading, user, router]);

  const [stepIndex, setStepIndex] = useState(0);
  const [selectedPillarId, setSelectedPillarId] = useState<PillarId | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<FocusPreference | null>(null);
  const [biological, setBiological] = useState<BiologicalProfile>({ ...initialBiologicalProfile });
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentTag[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentStep = FOUNDATION_STEPS[stepIndex];
  const stepMeta = FOUNDATION_STEP_META[currentStep];
  const isLastStep = stepIndex === FOUNDATION_STEPS.length - 1;

  const canAdvance =
    currentStep === 'focus'
      ? selectedPreference !== null
      : currentStep === 'biology'
        ? isBiologicalProfileComplete(biological)
        : selectedEquipment.length > 0;

  const patchBiological = useCallback((patch: Partial<BiologicalProfile>) => {
    setBiological((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleEquipment = useCallback((id: EquipmentTag) => {
    setSelectedEquipment((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleContinue = async () => {
    if (!canAdvance || isSaving) return;

    if (!isLastStep) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    if (!selectedPreference) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      completeFoundationScan({
        focus_preference: selectedPreference,
        available_equipment: selectedEquipment,
        biological,
      });

      const localStats = useSommaStore.getState().user_stats;

      if (isSupabaseConfigured && user?.id) {
        await syncFoundationToSupabase(user.id, {
          focus_preference: selectedPreference,
          available_equipment: selectedEquipment,
          user_stats: localStats,
          biological,
        });
      }

      await fetchDailyGameplanAsync({ forceRefresh: true });

      router.replace('/(tabs)/home');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Could not sync foundation data. Try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((prev) => prev - 1);
  };

  const renderStepContent = () => {
    if (currentStep === 'focus') {
      return PILLAR_OPTIONS.map((option) => (
        <SelectionTile
          key={option.id}
          label={option.label}
          subtitle={option.subtitle}
          selected={selectedPillarId === option.id}
          onPress={() => {
            setSelectedPillarId(option.id);
            setSelectedPreference(option.preference);
          }}
          accessibilityLabel={`Select ${option.label} focus`}
        />
      ));
    }

    if (currentStep === 'biology') {
      return <BiologicalPassportForm value={biological} onChange={patchBiological} />;
    }

    return EQUIPMENT_OPTIONS.map((option) => (
      <SelectionTile
        key={option.id}
        label={option.label}
        selected={selectedEquipment.includes(option.id)}
        onPress={() => toggleEquipment(option.id)}
        accessibilityLabel={`Toggle ${option.label}`}
      />
    ));
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <StatusBar style="light" />
      <View className="flex-1 px-8 pb-8 pt-6">
        <FoundationProgress currentStep={stepIndex} totalSteps={FOUNDATION_STEPS.length} />

        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mt-8 self-start py-1 active:opacity-60"
        >
          <Text className="font-body text-xs uppercase tracking-[0.3em] text-[#6B7568]">
            Back
          </Text>
        </Pressable>

        <View className="mt-10">
          <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
            {stepMeta.eyebrow}
          </Text>
          <Text className="mt-4 font-display-bold text-4xl leading-[1.15] text-[#E8E4DC]">
            {stepMeta.title}
          </Text>
          <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">{stepMeta.hint}</Text>
        </View>

        <ScrollView
          className="mt-8 flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-3 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
        </ScrollView>

        {saveError ? (
          <Text className="mb-2 text-center font-body text-xs text-blood-red">{saveError}</Text>
        ) : null}

        <Pressable
          onPress={handleContinue}
          disabled={!canAdvance || isSaving}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Enter the sanctuary' : 'Continue'}
          accessibilityState={{ disabled: !canAdvance || isSaving }}
          className={`mt-4 overflow-hidden rounded-2xl border px-8 py-5 ${
            canAdvance && !isSaving
              ? 'border-matte-gold/40 bg-matte-gold/10 active:opacity-80'
              : 'border-white/5 bg-white/[0.02] opacity-40'
          }`}
          style={
            canAdvance && !isSaving
              ? {
                  shadowColor: '#BFA06A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 16,
                }
              : undefined
          }
        >
          {isSaving ? (
            <ActivityIndicator color="#BFA06A" />
          ) : (
            <Text
              className={`text-center font-body-medium text-sm uppercase tracking-[0.35em] ${
                canAdvance ? 'text-matte-gold' : 'text-[#6B7568]'
              }`}
            >
              {isLastStep ? 'Enter Sanctuary' : 'Continue'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
