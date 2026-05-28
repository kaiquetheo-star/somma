import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface CommandCenterShellProps {
  /** Pillar label, e.g. "Iron · Command" */
  pillarLabel: string;
  /** Active movement or session title */
  title: string;
  /** Set / round / pose progress */
  meta?: string;
  children: ReactNode;
}

/** Typography-first workout command surface — shared chrome for pillar screens */
export function CommandCenterShell({
  pillarLabel,
  title,
  meta,
  children,
}: CommandCenterShellProps) {
  return (
    <View className="min-w-0 gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4">
      <View className="min-w-0 gap-1">
        <Text className="flex-shrink font-body text-[10px] uppercase leading-5 tracking-[0.32em] text-matte-gold/75">
          {pillarLabel}
        </Text>
        <Text className="flex-shrink whitespace-normal break-words font-display-bold text-2xl leading-8 text-[#E8E4DC]">
          {title}
        </Text>
        {meta ? (
          <Text className="flex-shrink whitespace-normal break-words font-body text-[10px] uppercase leading-5 tracking-[0.22em] text-[#6B7568]">
            {meta}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
