import { Text, View } from 'react-native';

import { AttunementOrbs } from '@/components/sanctuary/AttunementOrbs';
import { getTodayRitualProgress } from '@/lib/sanctuary/attunement';
import type { UserStats } from '@/store/useSommaStore';
import type { DailyGameplan } from '@/types/gameplan';
import { isBiologicalProfileComplete, type BiologicalProfile } from '@/types/biological';

interface AttunementOrbsPanelProps {
  stats: UserStats;
  biological?: BiologicalProfile;
  gameplan?: DailyGameplan | null;
}

/** Sanctuary attunement card — essence orbs + today's pillar completion */
export function AttunementOrbsPanel({ stats, biological, gameplan }: AttunementOrbsPanelProps) {
  const showBiological = biological && isBiologicalProfileComplete(biological);
  const { completedBlocks, totalBlocks, completedPillars } = getTodayRitualProgress(gameplan ?? null);

  const subtitle =
    totalBlocks > 0
      ? completedBlocks === totalBlocks
        ? "Today's ritual complete — all pillars attuned"
        : `Today's ritual · ${completedBlocks}/${totalBlocks} blocks · ${completedPillars.length} pillar${completedPillars.length === 1 ? '' : 's'} lit`
      : 'Pillar focus radiating from your Foundation Scan';

  return (
    <View className="min-w-0 w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-moss-900/40 px-5 py-6">
      <Text className="text-center font-body text-[10px] uppercase leading-5 tracking-[0.3em] text-[#6B7568]">
        Attunement Orbs
      </Text>
      <Text className="mt-1 flex-shrink whitespace-normal break-words text-center font-body text-xs leading-5 text-[#8A9488]">
        {subtitle}
      </Text>

      <View className="mt-4 items-center">
        <AttunementOrbs stats={stats} completedPillars={completedPillars} />
      </View>

      {showBiological ? (
        <Text className="mt-2 flex-shrink whitespace-normal break-words text-center font-body text-[10px] uppercase leading-5 tracking-[0.2em] text-[#6B7568]">
          {biological.weight_kg} kg · stress {biological.baseline_stress_level}/10
        </Text>
      ) : null}
    </View>
  );
}
