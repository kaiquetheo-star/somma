import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LoadingFallbackProps {
  message?: string;
  eyebrow?: string;
}

/** Full-screen gate while Zustand rehydrates or gameplan/block data is loading */
export function LoadingFallback({
  message = 'Loading your protocol…',
  eyebrow = 'SOMMA',
}: LoadingFallbackProps) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#0F1512] px-10">
      <Text className="font-body text-[10px] uppercase tracking-[0.45em] text-matte-gold/70">
        {eyebrow}
      </Text>
      <ActivityIndicator className="mt-8" color="#BFA06A" />
      <Text className="mt-6 text-center font-body text-sm leading-6 text-[#8A9488]">
        {message}
      </Text>
    </SafeAreaView>
  );
}
