import { Pressable, Text, View } from 'react-native';

import {
  clampTrainingDaysPerWeek,
  formatTrainingDaysPerWeek,
  TRAINING_DAYS_MAX,
  TRAINING_DAYS_MIN,
} from '@/types/biological';

interface TrainingFrequencySelectProps {
  value: number | null;
  onChange: (days: number) => void;
}

const DAY_OPTIONS = Array.from(
  { length: TRAINING_DAYS_MAX - TRAINING_DAYS_MIN + 1 },
  (_, index) => TRAINING_DAYS_MIN + index,
);

/** Weekly availability selector — 1–7 training days for microcycle planning */
export function TrainingFrequencySelect({ value, onChange }: TrainingFrequencySelectProps) {
  const selected = clampTrainingDaysPerWeek(value ?? 4);

  return (
    <View className="gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5">
      <View>
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
          Training frequency
        </Text>
        <Text className="mt-2 font-display text-2xl text-[#E8E4DC]">
          {formatTrainingDaysPerWeek(selected)}
        </Text>
        <Text className="mt-2 font-body text-xs leading-5 text-[#6B7568]">
          Days per week you can train — the clinic uses this to plan your microcycle, not isolated
          random sessions.
        </Text>
      </View>

      <View className="flex-row justify-between gap-1.5">
        {DAY_OPTIONS.map((day) => {
          const active = day === selected;
          return (
            <Pressable
              key={day}
              onPress={() => onChange(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day} days per week`}
              className={`h-11 flex-1 items-center justify-center rounded-xl border active:opacity-80 ${
                active
                  ? 'border-matte-gold/45 bg-matte-gold/12'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <Text
                className={`font-body-medium text-sm ${
                  active ? 'text-matte-gold' : 'text-[#8A9488]'
                }`}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row justify-between px-0.5">
        <Text className="font-body text-[9px] uppercase tracking-[0.2em] text-[#6B7568]">
          1 · minimal
        </Text>
        <Text className="font-body text-[9px] uppercase tracking-[0.2em] text-[#6B7568]">
          7 · daily
        </Text>
      </View>
    </View>
  );
}
