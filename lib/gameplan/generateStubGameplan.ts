import {
  dateForDayIndex,
  getDayIndexForDate,
  getWeekStartMonday,
  spreadTrainingDayIndices,
} from '@/lib/gameplan/microcycleWeek';
import type { DailyGameplan, GameplanBlock, MicrocycleDay, WorkoutPillar } from '@/types/gameplan';
import type { EquipmentTag, FocusPreference } from '@/store/useSommaStore';
import { DEFAULT_TRAINING_DAYS_PER_WEEK } from '@/types/biological';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ironSubtitle(equipment: EquipmentTag[]): string {
  if (equipment.includes('barbell') || equipment.includes('full_gym')) {
    return 'Barbell bench · 4×8 · AI load pending';
  }
  if (equipment.includes('dumbbells')) {
    return 'Dumbbell press · 4×10 · AI load pending';
  }
  return 'Push-up progression · 4×12 · bodyweight';
}

function combatSubtitle(equipment: EquipmentTag[]): string {
  if (equipment.includes('heavy_bag')) {
    return '3×3 min rounds · Jab–Cross–Hook–Low kick';
  }
  return 'Shadow rounds · 3×3 min · footwork focus';
}

function createBlock(
  partial: Omit<GameplanBlock, 'order' | 'status'> & { order: number },
): GameplanBlock {
  return { ...partial, status: 'pending' };
}

/** Deterministic stub gameplan from foundation data until Edge Function ships */
export function generateStubGameplan(
  focus: FocusPreference,
  equipment: EquipmentTag[],
  trainingDaysPerWeek?: number,
): DailyGameplan {
  const ranked = [
    { pillar: 'iron' as const, weight: focus.iron },
    { pillar: 'combat' as const, weight: focus.combat },
    { pillar: 'spirit' as const, weight: focus.spirit },
    { pillar: 'flow' as const, weight: focus.flow },
  ].sort((a, b) => b.weight - a.weight);

  const top = ranked[0];
  const blocks: GameplanBlock[] = [];
  let order = 0;

  if (focus.flow >= 15) {
    blocks.push(
      createBlock({
        id: 'block-morning-flow',
        pillar: 'spirit',
        title: 'Morning Flow',
        subtitle: 'Mobility sequence · 18 min · nervous system primer',
        duration_minutes: 18,
        order: order++,
      }),
    );
  }

  const topPillar = top.pillar === 'flow' ? 'spirit' : top.pillar;

  if (topPillar === 'iron') {
    blocks.push(
      createBlock({
        id: 'block-main-iron',
        pillar: 'iron',
        title: 'Main Ritual: Iron',
        subtitle: ironSubtitle(equipment),
        duration_minutes: 45,
        order: order++,
      }),
    );
  } else if (topPillar === 'combat') {
    blocks.push(
      createBlock({
        id: 'block-main-combat',
        pillar: 'combat',
        title: 'Main Ritual: Blood & Bone',
        subtitle: combatSubtitle(equipment),
        duration_minutes: 40,
        order: order++,
      }),
    );
  } else {
    blocks.push(
      createBlock({
        id: 'block-main-spirit',
        pillar: 'spirit',
        title: 'Main Ritual: Spirit',
        subtitle: '4-7-8 breathwork · 20 min · vagal tone',
        duration_minutes: 20,
        order: order++,
      }),
    );
  }

  const second = ranked.find((entry) => entry.pillar !== 'flow' && entry.pillar !== top.pillar);
  if (second && second.pillar !== 'flow' && second.weight >= 20) {
    const pillar = second.pillar as WorkoutPillar;
    blocks.push(
      createBlock({
        id: `block-secondary-${pillar}`,
        pillar,
        title:
          pillar === 'iron'
            ? 'Accessory: Iron'
            : pillar === 'combat'
              ? 'Finisher: Blood & Bone'
              : 'Evening: Spirit',
        subtitle:
          pillar === 'iron'
            ? 'Pull density · 25 min'
            : pillar === 'combat'
              ? '2×2 min burnout · combos'
              : 'Box breathing · 12 min',
        duration_minutes: pillar === 'iron' ? 25 : pillar === 'combat' ? 15 : 12,
        order: order++,
      }),
    );
  }

  if (focus.spirit >= 25 && topPillar !== 'spirit') {
    blocks.push(
      createBlock({
        id: 'block-evening-spirit',
        pillar: 'spirit',
        title: 'Evening Spirit',
        subtitle: 'NSDR breath · 15 min · downregulation',
        duration_minutes: 15,
        order: order++,
      }),
    );
  }

  const date = todayDateKey();
  const week_start_date = getWeekStartMonday(date);
  const training_days_per_week = trainingDaysPerWeek ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
  const trainingIndices = new Set(spreadTrainingDayIndices(training_days_per_week));

  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, index) => {
    const day_index = index + 1;
    const isTraining = trainingIndices.has(day_index);
    return {
      day_index,
      is_rest_day: !isTraining,
      focus_label: isTraining ? 'Stub protocol' : 'Rest & Recovery',
      date: dateForDayIndex(week_start_date, day_index),
      blocks: isTraining ? blocks : [],
    };
  });

  const todayIndex = getDayIndexForDate(date, week_start_date);
  const todayBlocks =
    microcycle.find((day) => day.day_index === todayIndex)?.blocks ?? [];

  return {
    date,
    week_start_date,
    training_days_per_week,
    microcycle,
    blocks: todayBlocks,
    generated_at: new Date().toISOString(),
  };
}

export function isProtocolDateStale(protocolDate: string | null): boolean {
  if (!protocolDate) return true;
  return protocolDate !== todayDateKey();
}

export function isGameplanStale(gameplan: DailyGameplan | null): boolean {
  if (!gameplan) return true;
  return isProtocolDateStale(gameplan.date);
}
