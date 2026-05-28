import { Text, View } from 'react-native';

import { resolvePrimaryInstruction } from '@/lib/iron/instructionCues';

interface InstructionPanelProps {
  instructions: Record<string, unknown>;
  /** Shown when catalog JSONB has no usable cue text */
  emptyFallback?: string;
}

const DEFAULT_EMPTY =
  'Establish braced posture, control the eccentric, and finish each rep with intent. Expand biomechanical profile for full cues.';

/** Always-visible primary coaching cue — setup first, catalog fallbacks second */
export function InstructionPanel({
  instructions,
  emptyFallback = DEFAULT_EMPTY,
}: InstructionPanelProps) {
  const primary = resolvePrimaryInstruction(instructions);
  const label = primary?.label ?? 'Command';
  const text = primary?.text ?? emptyFallback;

  return (
    <View className="min-w-0 overflow-hidden rounded-2xl border border-matte-gold/25 bg-matte-gold/[0.05] px-5 py-4">
      <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.32em] text-matte-gold/85">
        {label}
      </Text>
      <Text className="mt-3 flex-shrink whitespace-normal break-words font-body text-base leading-7 text-[#E8E4DC]">
        {text}
      </Text>
      {!primary ? (
        <Text className="mt-2 flex-shrink whitespace-normal break-words font-body text-xs leading-5 text-[#6B7568]">
          Catalog cue pending — using default iron command copy.
        </Text>
      ) : null}
    </View>
  );
}
