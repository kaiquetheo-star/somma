import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MICROCYCLE_DAY_LABELS } from '@/lib/gameplan/microcycleWeek';
import type { MicrocycleDay } from '@/types/gameplan';

const MATTE_GOLD = '#BFA06A';

interface WeeklyMicrocycleStripProps {
  microcycle: MicrocycleDay[] | null;
  selectedDayIndex: number;
  todayDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
}

/** Horizontal 7-day glass strip — Head Coach microcycle navigator */
export function WeeklyMicrocycleStrip({
  microcycle,
  selectedDayIndex,
  todayDayIndex,
  onSelectDay,
}: WeeklyMicrocycleStripProps) {
  if (!microcycle?.length) return null;

  return (
    <View className="mt-8 w-full overflow-hidden rounded-3xl border border-white/10 bg-moss-900/40 px-2 py-4">
      <Text className="mb-3 text-center font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Weekly microcycle
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-2"
      >
        {MICROCYCLE_DAY_LABELS.map((label, index) => {
          const dayIndex = index + 1;
          const day = microcycle.find((entry) => entry.day_index === dayIndex);
          const isSelected = selectedDayIndex === dayIndex;
          const isToday = todayDayIndex === dayIndex;
          const isRest = day?.is_rest_day ?? true;
          const isCompleted = day?.is_completed === true;
          const blockCount = day?.blocks.length ?? 0;

          return (
            <Pressable
              key={dayIndex}
              onPress={() => onSelectDay(dayIndex)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${label}${isToday ? ', today' : ''}${isRest ? ', rest day' : ''}${isCompleted ? ', completed' : ''}`}
              className={`items-center justify-center rounded-2xl border px-3.5 py-3 active:opacity-85 ${
                isCompleted
                  ? 'border-matte-gold/40 bg-matte-gold/15'
                  : isSelected
                    ? 'border-matte-gold/70 bg-matte-gold/20'
                    : isRest
                      ? 'border-white/5 bg-white/5 opacity-50'
                      : 'border-white/12 bg-white/5'
              }`}
              style={[
                { minWidth: 54 },
                isSelected || isCompleted
                  ? {
                      shadowColor: MATTE_GOLD,
                      shadowOpacity: isCompleted ? 0.35 : 0.5,
                      shadowRadius: isCompleted ? 8 : 12,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: isCompleted ? 4 : 6,
                    }
                  : undefined,
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color={MATTE_GOLD} />
              ) : null}
              <Text
                className={`font-body text-[10px] uppercase tracking-[0.2em] ${
                  isCompleted || isSelected
                    ? 'text-matte-gold'
                    : isRest
                      ? 'text-[#5C6659]'
                      : 'text-[#9AA39A]'
                }`}
              >
                {label}
              </Text>
              {isCompleted ? (
                <Text className="mt-1 font-body text-[8px] uppercase tracking-[0.15em] text-matte-gold/75">
                  Done
                </Text>
              ) : !isRest && blockCount > 0 ? (
                <Text
                  className={`mt-1 font-body text-[9px] ${
                    isSelected ? 'text-matte-gold/80' : 'text-[#6B7568]'
                  }`}
                >
                  {blockCount} block{blockCount === 1 ? '' : 's'}
                </Text>
              ) : isRest ? (
                <Text className="mt-1 font-body text-[9px] text-[#5C6659]">Rest</Text>
              ) : null}
              {isToday && !isSelected && !isCompleted ? (
                <View className="mt-1 h-1 w-1 rounded-full bg-matte-gold/60" />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
