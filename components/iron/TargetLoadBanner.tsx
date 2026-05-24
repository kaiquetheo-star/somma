import { Text, View } from 'react-native';

interface TargetLoadBannerProps {
  targetKg: number | null;
  repRange?: string;
  /** Whether load came from Head Coach prescription vs live E1RM query */
  source?: 'prescription' | 'e1rm';
}

/** Prominent SHRED-style target load — tells the athlete exactly what to pick up */
export function TargetLoadBanner({ targetKg, repRange, source }: TargetLoadBannerProps) {
  const hasLoad = targetKg != null && targetKg > 0;

  if (!hasLoad) {
    return (
      <View className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4">
        <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-[#8A9488]">
          Target load
        </Text>
        <Text className="mt-1 font-display-bold text-2xl leading-8 tracking-tight text-[#E8E4DC]">
          Calibrate First Set
        </Text>
        <Text className="mt-2 font-body text-sm leading-5 text-[#8A9488]">
          No strength history for this movement yet. Choose a working weight you can hit at the
          prescribed RIR — the Head Coach calibrates from your log.
        </Text>
        {repRange ? (
          <Text className="mt-2 font-body text-xs text-[#6B7568]">{repRange}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-matte-gold/40 bg-matte-gold/[0.08] px-5 py-4">
      <Text className="font-body text-[10px] uppercase tracking-[0.4em] text-matte-gold/85">
        Target load
      </Text>
      <Text className="mt-1 font-display-bold text-4xl tracking-tight text-matte-gold">
        {targetKg} kg
      </Text>
      <Text className="mt-2 font-body text-sm leading-5 text-[#C8C4BC]">
        Pick up this weight for your working sets.
      </Text>
      {repRange ? (
        <Text className="mt-1 font-body text-xs text-[#8A9488]">{repRange}</Text>
      ) : null}
      {source === 'e1rm' ? (
        <Text className="mt-2 font-body text-[10px] uppercase tracking-[0.25em] text-[#6B7568]">
          Calibrated from your 3-week strength profile
        </Text>
      ) : null}
    </View>
  );
}
