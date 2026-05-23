import { Text, TextInput, View } from 'react-native';

import { PillarGoalSelect } from '@/components/foundation/PillarGoalSelect';
import { TrainingFrequencySelect } from '@/components/foundation/TrainingFrequencySelect';
import { ValueStepper } from '@/components/iron/ValueStepper';
import { RpeSelector } from '@/components/combat/RpeSelector';
import type { BiologicalProfile, PillarGoalKey } from '@/types/biological';

interface BiologicalPassportFormProps {
  value: BiologicalProfile;
  onChange: (patch: Partial<BiologicalProfile>) => void;
}

export function BiologicalPassportForm({ value, onChange }: BiologicalPassportFormProps) {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Date of birth
        </Text>
        <TextInput
          value={value.date_of_birth ?? ''}
          onChangeText={(text) => onChange({ date_of_birth: text.trim() || null })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#4A5D44"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-base text-[#E8E4DC]"
        />
        <Text className="font-body text-xs text-[#6B7568]">Used to calibrate age-appropriate load.</Text>
      </View>

      <ValueStepper
        label="Body weight"
        value={value.weight_kg ?? 70}
        unit="kg"
        step={1}
        min={30}
        max={200}
        onChange={(weight_kg) => onChange({ weight_kg })}
      />

      <ValueStepper
        label="Height"
        value={value.height_cm ?? 170}
        unit="cm"
        step={1}
        min={120}
        max={230}
        onChange={(height_cm) => onChange({ height_cm })}
      />

      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Body fat % (optional)
        </Text>
        <TextInput
          value={
            value.body_fat_percentage != null ? String(value.body_fat_percentage) : ''
          }
          onChangeText={(text) => {
            const trimmed = text.trim();
            if (!trimmed) {
              onChange({ body_fat_percentage: null });
              return;
            }
            const parsed = Number.parseFloat(trimmed);
            onChange({
              body_fat_percentage: Number.isFinite(parsed) ? parsed : null,
            });
          }}
          placeholder="e.g. 18"
          placeholderTextColor="#4A5D44"
          keyboardType="decimal-pad"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-base text-[#E8E4DC]"
        />
      </View>

      <View className="gap-2">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Current injuries or limitations (optional)
        </Text>
        <TextInput
          value={value.current_injuries ?? ''}
          onChangeText={(text) =>
            onChange({ current_injuries: text.trim() ? text.trim() : null })
          }
          placeholder="e.g. Left shoulder impingement — avoid overhead press"
          placeholderTextColor="#4A5D44"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          className="min-h-[88px] rounded-2xl border border-white/10 bg-white/5 px-4 py-4 font-body text-sm leading-6 text-[#E8E4DC]"
        />
      </View>

      <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <RpeSelector
          value={value.baseline_stress_level}
          onChange={(baseline_stress_level) => onChange({ baseline_stress_level })}
        />
        <Text className="mt-3 text-center font-body text-xs text-[#6B7568]">
          Baseline nervous-system load · 1 calm · 10 overloaded
        </Text>
      </View>

      <TrainingFrequencySelect
        value={value.training_days_per_week}
        onChange={(training_days_per_week) => onChange({ training_days_per_week })}
      />

      <View className="gap-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
          Pillar goals
        </Text>
        <Text className="font-body text-xs leading-5 text-[#6B7568]">
          Each specialist coach uses these targets when building your daily protocol.
        </Text>
        {(['iron', 'combat', 'flow', 'spirit'] as PillarGoalKey[]).map((pillar) => (
          <PillarGoalSelect
            key={pillar}
            pillar={pillar}
            value={value[`goal_${pillar}`]}
            onChange={(goal) => onChange({ [`goal_${pillar}`]: goal })}
          />
        ))}
      </View>
    </View>
  );
}
