import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailAuthPanel } from '@/components/auth/EmailAuthPanel';
import { isSupabaseConfigured } from '@/lib/config';
import { useAuth } from '@/providers/AuthProvider';
import { hasCompletedFoundationScan, useSommaStore } from '@/store/useSommaStore';

export default function WelcomeAuthScreen() {
  const router = useRouter();
  const { isConfigured, isLoading, session } = useAuth();

  const userFoundation = useSommaStore((state) => state.user_foundation);
  const userEnvironment = useSommaStore((state) => state.user_environment);
  const userBiological = useSommaStore((state) => state.user_biological);

  const hasRoutedRef = useRef(false);

  const foundationComplete = hasCompletedFoundationScan({
    user_foundation: userFoundation,
    user_environment: userEnvironment,
    user_biological: userBiological,
  });

  useEffect(() => {
    hasRoutedRef.current = false;
  }, [session?.user?.id, foundationComplete]);

  useEffect(() => {
    if (!isConfigured || isLoading || !session || hasRoutedRef.current) return;

    hasRoutedRef.current = true;

    if (foundationComplete) {
      router.replace('/(tabs)/home');
      return;
    }

    router.replace('/(auth)/foundation');
  }, [isConfigured, isLoading, session, foundationComplete, router]);

  const handleBeginAwakeningOffline = () => {
    if (foundationComplete) {
      router.replace('/(tabs)/home');
      return;
    }
    router.push('/(auth)/foundation');
  };

  if (isConfigured && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-obsidian">
        <ActivityIndicator color="#BFA06A" />
      </SafeAreaView>
    );
  }

  if (isConfigured && session && !hasRoutedRef.current) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-obsidian">
        <ActivityIndicator color="#BFA06A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <StatusBar style="light" />
      <View className="flex-1 justify-between px-8 pb-10 pt-16">
        <View className="items-center">
          <Text className="text-center font-display text-[11px] uppercase tracking-[0.45em] text-matte-gold/70">
            The Longevity OS
          </Text>
        </View>

        <View className="items-center">
          <Text className="text-center font-display-bold text-6xl leading-tight tracking-wide text-[#E8E4DC]">
            SOMMA
          </Text>
        </View>

        <View className="gap-4">
          {isConfigured ? (
            <EmailAuthPanel />
          ) : (
            <>
              <Pressable
                onPress={handleBeginAwakeningOffline}
                accessibilityRole="button"
                accessibilityLabel="Begin your awakening offline"
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] px-8 py-5 active:opacity-80"
              >
                <Text className="text-center font-body text-sm uppercase tracking-[0.35em] text-[#E8E4DC]">
                  Begin Awakening
                </Text>
                <Text className="mt-2 text-center font-body text-[10px] text-[#6B7568]">
                  Offline path · no account required
                </Text>
              </Pressable>
              <Text className="text-center font-body text-[10px] text-[#4A5D44]">
                Supabase not detected — check EXPO_PUBLIC_SUPABASE_URL and
                EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
              </Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
