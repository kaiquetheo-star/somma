import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  formatCnsFatigueCost,
  formatJointStress,
  type IronExerciseBiomechanics,
} from '@/types/catalog';

interface ExerciseCueCardProps {
  instructions: Record<string, string>;
  progressionNote?: string;
  biomechanics?: IronExerciseBiomechanics | null;
  /** Keys already shown in InstructionPanel — omitted from deep-dive list */
  excludeKeys?: string[];
}

const CUE_ORDER = ['setup', 'eccentric', 'concentric', 'safety', 'regression'] as const;

const CUE_LABELS: Record<string, string> = {
  setup: 'Setup',
  eccentric: 'Eccentric',
  concentric: 'Concentric',
  safety: 'Safety',
  regression: 'Regression',
};

function BiomechanicsStrip({ biomechanics }: { biomechanics: IronExerciseBiomechanics }) {
  const synergistLine =
    biomechanics.synergist_muscles.length > 0
      ? biomechanics.synergist_muscles.join(' · ')
      : null;

  return (
    <View className="gap-2 border-b border-white/5 pb-3">
      {biomechanics.primary_muscle ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-matte-gold/80">
            Target
          </Text>
          <Text className="font-body-medium text-sm capitalize text-[#E8E4DC]">
            {biomechanics.primary_muscle.replace(/_/g, ' ')}
          </Text>
          {biomechanics.stretch_mediated_hypertrophy ? (
            <View className="rounded-full border border-matte-gold/30 bg-matte-gold/10 px-2 py-0.5">
              <Text className="font-body text-[9px] uppercase tracking-[0.15em] text-matte-gold">
                Stretch-biased
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {synergistLine ? (
        <Text className="font-body text-xs leading-5 text-[#8A9488]">
          Synergists · {synergistLine.replace(/_/g, ' ')}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {biomechanics.cns_fatigue_cost != null ? (
          <Text className="font-body text-[10px] uppercase tracking-[0.2em] text-[#6B7568]">
            CNS · {formatCnsFatigueCost(biomechanics.cns_fatigue_cost)}
          </Text>
        ) : null}
        {biomechanics.joint_stress_profile ? (
          <Text className="font-body text-[10px] uppercase tracking-[0.2em] text-[#6B7568]">
            Joint · {formatJointStress(biomechanics.joint_stress_profile)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Collapsible biomechanical cues — Quiet Luxury typography */
export function ExerciseCueCard({
  instructions,
  progressionNote,
  biomechanics,
  excludeKeys = [],
}: ExerciseCueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const excluded = new Set(excludeKeys);

  const entries = [
    ...CUE_ORDER.flatMap((key) => {
      if (excluded.has(key)) return [];
      const value = instructions[key];
      if (!value) return [];
      return [{ key, label: CUE_LABELS[key] ?? key, value }];
    }),
    ...Object.entries(instructions)
      .filter(
        ([key]) =>
          !CUE_ORDER.includes(key as (typeof CUE_ORDER)[number]) && !excluded.has(key),
      )
      .map(([key, value]) => ({
        key,
        label: key.replace(/_/g, ' '),
        value,
      })),
  ];

  const hasBiomechanics =
    biomechanics &&
    (biomechanics.primary_muscle ||
      biomechanics.cns_fatigue_cost != null ||
      biomechanics.joint_stress_profile);

  if (entries.length === 0 && !progressionNote && !hasBiomechanics) return null;

  return (
    <View className="gap-5 rounded-2xl border border-white/8 bg-white/[0.03]">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between px-5 py-4 active:opacity-80"
      >
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Biomechanical profile
        </Text>
        <Text className="font-body text-sm text-matte-gold/80">{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded ? (
        <View className="gap-3 border-t border-white/5 px-5 pb-4 pt-3">
          {hasBiomechanics && biomechanics ? (
            <BiomechanicsStrip biomechanics={biomechanics} />
          ) : null}
          {progressionNote ? (
            <View>
              <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-matte-gold/70">
                AI note
              </Text>
              <Text className="mt-1 font-body text-sm leading-6 text-[#8A9488]">
                {progressionNote}
              </Text>
            </View>
          ) : null}
          {entries.map((entry) => (
            <View key={entry.key}>
              <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
                {entry.label}
              </Text>
              <Text className="mt-1 font-body text-sm leading-6 text-[#A8B0A6]">
                {entry.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
