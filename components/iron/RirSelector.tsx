import { Pressable, Text, View } from 'react-native';

interface RirSelectorProps {
  value: number | null;
  prescribedRir?: number;
  onChange: (rir: number) => void;
}

/** Post-set reps-in-reserve capture (0–4) — mirrors combat RPE gate aesthetic */
export function RirSelector({ value, prescribedRir = 2, onChange }: RirSelectorProps) {
  const options = [0, 1, 2, 3, 4] as const;

  return (
    <View className="gap-3">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Reps in reserve (0–4)
      </Text>
      <View className="flex-row flex-wrap justify-center gap-2">
        {options.map((rir) => {
          const selected = value === rir;
          const isPrescribed = rir === prescribedRir;
          return (
            <Pressable
              key={rir}
              onPress={() => onChange(rir)}
              accessibilityRole="button"
              accessibilityLabel={`${rir} RIR`}
              className={`h-12 min-w-[52px] items-center justify-center rounded-full border px-3 ${
                selected
                  ? 'border-matte-gold bg-matte-gold/20'
                  : isPrescribed
                    ? 'border-matte-gold/35 bg-matte-gold/[0.06]'
                    : 'border-white/15 bg-white/[0.04]'
              }`}
            >
              <Text
                className={`font-body-medium text-sm ${
                  selected ? 'text-matte-gold' : 'text-[#8A9488]'
                }`}
              >
                {rir}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => onChange(prescribedRir)}
        accessibilityRole="button"
        accessibilityLabel={`Use prescribed ${prescribedRir} RIR`}
        className="items-center py-2 active:opacity-80"
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.28em] text-[#6B7568]">
          Use prescribed · {prescribedRir} RIR
        </Text>
      </Pressable>
    </View>
  );
}
