import { clampCnsFatigueProfile } from '@/types/biological';
import { clampCnsFatigueScore, totalCnsDeltaFromQueue } from '@/lib/gameplan/engine/clinicalLaws';
import { getSupabase } from '@/lib/supabase/client';
import type { PerformanceQueueItem } from '@/types/performance';

/** Persist rolling CNS fatigue after performance_logs insert (Clinical Law III). */
export async function applyCnsFatigueFromQueue(
  userId: string,
  queue: PerformanceQueueItem[],
  currentScore: number,
): Promise<number> {
  const delta = totalCnsDeltaFromQueue(queue);
  if (delta === 0) return currentScore;

  const next = clampCnsFatigueScore(currentScore + delta);
  const supabase = getSupabase();
  if (!supabase) return next;

  const { error } = await supabase
    .from('profiles')
    .update({ cns_fatigue_score: next })
    .eq('id', userId);

  if (error) {
    console.warn('[SOMMA] cns_fatigue_score update failed:', error.message);
    return clampCnsFatigueProfile(currentScore + delta);
  }

  return next;
}
