import { Pressable, Text, TextInput, View } from 'react-native';

import { PILLAR_GOAL_PRESETS, type PillarGoalKey } from '@/types/biological';

const PILLAR_LABELS: Record<PillarGoalKey, { title: string; hint: string }> = {
  iron: {
    title: 'Iron goal',
    hint: 'Hypertrophy vs strength drives set/rep and progression style.',
  },
  combat: {
    title: 'Combat goal',
    hint: 'Cardio conditioning vs technical mastery shapes round structure.',
  },
  flow: {
    title: 'Flow goal',
    hint: 'Mobility and recovery focus for movement prep.',
  },
  spirit: {
    title: 'Spirit goal',
    hint: 'Breathwork vs sanctuary flow for nervous-system work.',
  },
};

interface PillarGoalSelectProps {
  pillar: PillarGoalKey;
  value: string | null;
  onChange: (goal: string | null) => void;
}

/** Preset chips + free-text goal for one pillar coach */
export function PillarGoalSelect({ pillar, value, onChange }: PillarGoalSelectProps) {
  const presets = PILLAR_GOAL_PRESETS[pillar];
  const { title, hint } = PILLAR_LABELS[pillar];
  const trimmed = value?.trim() ?? '';

  return (
    <View className="gap-3">
      <View>
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          {title}
        </Text>
        <Text className="mt-1 font-body text-xs leading-5 text-[#6B7568]">{hint}</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {presets.map((preset) => {
          const selected = trimmed === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => onChange(preset)}
              className={`rounded-full border px-3 py-2 active:opacity-80 ${
                selected
                  ? 'border-matte-gold/45 bg-matte-gold/12'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <Text
                className={`font-body text-[11px] ${
                  selected ? 'text-matte-gold' : 'text-[#8A9488]'
                }`}
              >
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={value ?? ''}
        onChangeText={(text) => onChange(text.trim() ? text.trim() : null)}
        placeholder="Or describe your goal…"
        placeholderTextColor="#4A5D44"
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-body text-sm text-[#E8E4DC]"
      />
    </View>
  );
}
