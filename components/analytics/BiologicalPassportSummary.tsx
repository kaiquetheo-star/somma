import { Text, View } from 'react-native';

import {
  ageFromDateOfBirth,
  formatTrainingDaysPerWeek,
  type BiologicalProfile,
  isBiologicalProfileComplete,
} from '@/types/biological';

interface BiologicalPassportSummaryProps {
  profile: BiologicalProfile;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-3">
      <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
        {label}
      </Text>
      <Text className="max-w-[58%] text-right font-body-medium text-sm text-[#E8E4DC]">
        {value}
      </Text>
    </View>
  );
}

/** Read-only biological snapshot for Analytics tab */
export function BiologicalPassportSummary({ profile }: BiologicalPassportSummaryProps) {
  const age = ageFromDateOfBirth(profile.date_of_birth);
  const complete = isBiologicalProfileComplete(profile);

  return (
    <View className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-5">
      <Text className="border-b border-white/5 py-4 font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/70">
        Current baseline
      </Text>

      {!complete ? (
        <Text className="py-4 font-body text-sm leading-6 text-[#8A9488]">
          Passport incomplete — fill required fields below to unlock full AI calibration.
        </Text>
      ) : null}

      <SummaryRow
        label="Date of birth"
        value={profile.date_of_birth ?? '—'}
      />
      <SummaryRow label="Age" value={age != null ? `${age} years` : '—'} />
      <SummaryRow
        label="Mass"
        value={profile.weight_kg != null ? `${profile.weight_kg} kg` : '—'}
      />
      <SummaryRow
        label="Height"
        value={profile.height_cm != null ? `${profile.height_cm} cm` : '—'}
      />
      <SummaryRow
        label="Body fat"
        value={
          profile.body_fat_percentage != null
            ? `${profile.body_fat_percentage}%`
            : 'Not recorded'
        }
      />
      <SummaryRow
        label="Stress baseline"
        value={
          profile.baseline_stress_level != null
            ? `${profile.baseline_stress_level} / 10`
            : '—'
        }
      />
      <SummaryRow
        label="Training frequency"
        value={formatTrainingDaysPerWeek(profile.training_days_per_week)}
      />
      <View className="border-t border-white/5 py-3">
        <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
          Injuries & limits
        </Text>
        <Text className="mt-2 font-body text-sm leading-6 text-[#A8B0A6]">
          {profile.current_injuries?.trim() || 'None reported'}
        </Text>
      </View>

      <View className="border-t border-white/5 py-3">
        <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-[#6B7568]">
          Pillar goals
        </Text>
        <SummaryRow label="Iron" value={profile.goal_iron?.trim() || '—'} />
        <SummaryRow label="Combat" value={profile.goal_combat?.trim() || '—'} />
        <SummaryRow label="Flow" value={profile.goal_flow?.trim() || '—'} />
        <SummaryRow label="Spirit" value={profile.goal_spirit?.trim() || '—'} />
      </View>
    </View>
  );
}
