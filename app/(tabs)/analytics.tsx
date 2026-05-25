import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BiomarkerGrid } from '@/components/analytics/BiomarkerGrid';
import { LoadTelemetryStrip } from '@/components/iron/LoadTelemetryStrip';
import { BiologicalPassportSummary } from '@/components/analytics/BiologicalPassportSummary';
import { BiologicalPassportForm } from '@/components/foundation/BiologicalPassportForm';
import { useBiomarkerVault } from '@/hooks/useBiomarkerVault';
import { isSupabaseConfigured } from '@/lib/config';
import { upsertBiologicalPassport } from '@/lib/supabase/profile';
import { useAuth } from '@/providers/AuthProvider';
import { useSommaStore } from '@/store/useSommaStore';
import {
  initialBiologicalProfile,
  isBiologicalProfileComplete,
  type BiologicalProfile,
} from '@/types/biological';

/** Biological Passport — read, edit, and session controls */
export default function AnalyticsScreen() {
  const router = useRouter();
  const { session, signOut, refreshRemoteProfile } = useAuth();
  const storedBiological = useSommaStore((state) => state.user_biological);
  const setUserBiological = useSommaStore((state) => state.setUserBiological);
  const resetStore = useSommaStore((state) => state.resetStore);
  const performanceLogs = useSommaStore((state) => state.performance_logs);

  const [draft, setDraft] = useState<BiologicalProfile>(storedBiological);
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  const biomarkerVault = useBiomarkerVault({
    userId: session?.user?.id,
    enabled: isSupabaseConfigured && Boolean(session?.user?.id),
  });

  useEffect(() => {
    setDraft(storedBiological);
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

  const handleDraftChange = useCallback((patch: Partial<BiologicalProfile>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSavePassport = async () => {
    if (!isBiologicalProfileComplete(draft)) {
      Alert.alert(
        'Incomplete passport',
        'Date of birth, weight, height, baseline stress (1–10), and training frequency (1–7 days) are required.',
      );
      return;
    }

    setSaving(true);
    try {
      const normalized: BiologicalProfile = {
        ...draft,
        current_injuries: draft.current_injuries?.trim() || null,
      };
      setUserBiological(normalized);

      if (isSupabaseConfigured && session?.user?.id) {
        await upsertBiologicalPassport(session.user.id, normalized);
      }

      Alert.alert('Passport updated', 'Your biological baseline is saved and will inform AI protocols.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save to the cloud.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(storedBiological ?? { ...initialBiologicalProfile });
  };

  const hasChanges =
    JSON.stringify(draft) !== JSON.stringify(storedBiological ?? initialBiologicalProfile);

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured && session) {
        await signOut();
      }
    } finally {
      await resetStore();
      router.replace('/(auth)');
    }
  };

  const handleResetProfile = async () => {
    try {
      if (isSupabaseConfigured && session) {
        await signOut();
      }
    } finally {
      await resetStore();
      router.replace('/(auth)');
    }
  };

  const handleResetLocalOnly = async () => {
    await resetStore();
    router.replace('/(auth)/foundation');
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-8 pb-12 pt-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/70">
          Biological Passport
        </Text>
        <Text className="mt-3 font-display-bold text-3xl text-[#E8E4DC]">Your markers</Text>
        <Text className="mt-4 font-body text-sm leading-6 text-[#8A9488]">
          Anthropometric baseline, weekly training frequency, and per-pillar goals for the clinic
          coaches, plus your biomarker vault preview.
        </Text>

        {hydrating ? (
          <View className="mt-8 items-center py-6">
            <ActivityIndicator color="#BFA06A" />
          </View>
        ) : (
          <View className="mt-8 gap-8">
            <BiologicalPassportSummary profile={draft} />

            <LoadTelemetryStrip
              performanceLogs={performanceLogs}
              goalIron={draft.goal_iron ?? storedBiological.goal_iron}
              variant="detail"
            />

            <BiomarkerGrid
              latest={biomarkerVault.latest}
              documents={biomarkerVault.documents}
              loading={biomarkerVault.loading}
              uploading={biomarkerVault.uploading}
              error={biomarkerVault.error}
              onLogReading={biomarkerVault.logReading}
              onUploadLab={biomarkerVault.uploadLab}
              onRefresh={biomarkerVault.refresh}
            />

            <View className="gap-4">
              <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
                Edit baseline
              </Text>
              <BiologicalPassportForm value={draft} onChange={handleDraftChange} />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={handleDiscard}
                  disabled={!hasChanges || saving}
                  className={`flex-1 rounded-2xl border px-4 py-4 ${
                    hasChanges && !saving
                      ? 'border-white/15 bg-white/5 active:opacity-80'
                      : 'border-white/5 bg-white/[0.02] opacity-40'
                  }`}
                >
                  <Text className="text-center font-body-medium text-xs uppercase tracking-[0.25em] text-[#8A9488]">
                    Discard
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSavePassport}
                  disabled={saving}
                  className="flex-[2] overflow-hidden rounded-2xl border border-matte-gold/40 bg-matte-gold/10 px-4 py-4 active:opacity-80"
                >
                  {saving ? (
                    <ActivityIndicator color="#BFA06A" />
                  ) : (
                    <Text className="text-center font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
                      Save passport
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View className="mt-12 gap-3">
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
            Session
          </Text>

          {isSupabaseConfigured && session ? (
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 active:opacity-80"
            >
              <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-[#E8E4DC]">
                Sign out
              </Text>
              <Text className="mt-1 font-body text-xs text-[#6B7568]">{session.user.email}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleResetProfile}
            accessibilityRole="button"
            accessibilityLabel="Reset profile and sign out"
            className="rounded-2xl border border-blood-red/30 bg-blood-red/10 px-5 py-4 active:opacity-80"
          >
            <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-blood-red">
              Reset profile
            </Text>
            <Text className="mt-1 font-body text-xs text-[#8A9488]">
              Signs out, clears all local data, and returns to Welcome.
            </Text>
          </Pressable>

          <Pressable
            onPress={handleResetLocalOnly}
            accessibilityRole="button"
            accessibilityLabel="Reset local foundation data"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 active:opacity-80"
          >
            <Text className="font-body-medium text-sm uppercase tracking-[0.25em] text-[#E8E4DC]">
              Reset local foundation
            </Text>
            <Text className="mt-1 font-body text-xs text-[#8A9488]">
              Clears Zustand cache and opens Foundation Scan (keeps sign-in if active).
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
