import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { resolveBlockPreviewLabel } from '@/lib/catalog/library';
import type { GameplanBlock } from '@/types/gameplan';

interface GameplanBlockCardProps {
  block: GameplanBlock;
  onPress: () => void;
}

const STATUS_STYLES = {
  pending: 'border-white/10 bg-white/5',
  active: 'border-matte-gold/35 bg-matte-gold/10',
  completed: 'border-white/5 bg-white/[0.02] opacity-60',
} as const;

const PILLAR_ACCENT: Record<GameplanBlock['pillar'], string> = {
  iron: 'text-[#E8E4DC]',
  combat: 'text-dark-copper',
  spirit: 'text-matte-gold',
};

/** Glassmorphism ritual block — Daily Command (FSD 3.2) */
export function GameplanBlockCard({ block, onPress }: GameplanBlockCardProps) {
  const isCompleted = block.status === 'completed';
  const [previewLabel, setPreviewLabel] = useState(block.subtitle);

  useEffect(() => {
    let mounted = true;
    void resolveBlockPreviewLabel(block).then((label) => {
      if (mounted && label) setPreviewLabel(label);
    });
    return () => {
      mounted = false;
    };
  }, [block]);

  return (
    <Pressable
      onPress={onPress}
      disabled={isCompleted}
      accessibilityRole="button"
      accessibilityLabel={`Start ${block.title}`}
      accessibilityState={{ disabled: isCompleted }}
      className={`min-w-0 overflow-hidden rounded-2xl border px-5 py-4 active:opacity-85 ${STATUS_STYLES[block.status]}`}
      style={
        block.status === 'active'
          ? {
              shadowColor: '#BFA06A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
            }
          : undefined
      }
    >
      <View className="min-w-0 flex-row items-start gap-3">
        <View className="min-w-0 flex-1">
          <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.28em] text-[#6B7568]">
            {block.duration_minutes} min · {block.pillar}
          </Text>
          <Text className={`mt-2 flex-shrink whitespace-normal break-words font-display text-xl leading-7 ${PILLAR_ACCENT[block.pillar]}`}>
            {block.title}
          </Text>
          <Text className="mt-2 flex-shrink whitespace-normal break-words font-body text-sm leading-5 text-[#8A9488]">
            {previewLabel}
          </Text>
        </View>
        <Text className="shrink-0 font-body text-lg text-matte-gold/80">
          {isCompleted ? '✓' : '→'}
        </Text>
      </View>
    </Pressable>
  );
}
