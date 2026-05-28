import { Text, View } from 'react-native';

import { InstructionPanel } from '@/components/command-center/InstructionPanel';
import {
  flowSpiritInstructions,
  parseFlowSessionNames,
} from '@/lib/spirit/parseAsanaCatalog';
import type { LibraryFlowSpiritSession } from '@/types/catalog';

interface FlowStepperProps {
  catalogRow: LibraryFlowSpiritSession | null;
  /** Pose index label, e.g. "2 / 6" */
  poseMeta?: string;
  /** Hold countdown, e.g. "1:30" */
  holdLabel?: string;
}

/** Asana command surface — Sanskrit + English + biomechanical setup/cues */
export function FlowStepper({ catalogRow, poseMeta, holdLabel }: FlowStepperProps) {
  if (!catalogRow) {
    return (
      <View className="min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
        <Text className="flex-shrink whitespace-normal break-words font-body text-sm leading-6 text-[#8A9488]">
          Flow catalog cue pending — hold posture with nasal breath until the next pose.
        </Text>
      </View>
    );
  }

  const { englishName, sanskritName } = parseFlowSessionNames(catalogRow.session_name);
  const instructions = flowSpiritInstructions(catalogRow);

  return (
    <View className="min-w-0 gap-4">
      <View className="min-w-0 gap-1">
        {sanskritName ? (
          <Text className="flex-shrink whitespace-normal break-words font-display-bold text-xl leading-7 text-matte-gold/90">
            {sanskritName}
          </Text>
        ) : null}
        <Text
          className={`flex-shrink whitespace-normal break-words font-display-bold leading-8 text-[#E8E4DC] ${
            sanskritName ? 'text-lg' : 'text-2xl'
          }`}
        >
          {englishName}
        </Text>
        {poseMeta || holdLabel ? (
          <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.22em] text-[#6B7568]">
            {[poseMeta, holdLabel ? `${holdLabel} hold` : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>

      <InstructionPanel
        instructions={instructions}
        emptyFallback="Settle into the shape with nasal breath. Lengthen on inhale, soften on exhale."
      />

      {catalogRow.is_dynamic_flow ? (
        <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.26em] text-[#6B7568]">
          Dynamic flow · breath-linked movement
        </Text>
      ) : null}
    </View>
  );
}
