import type { FlowAsanaPrescription, SpiritBlockPrescription } from '@/types/gameplan';

/** Ordered flow items from gameplan (`asanas` or AI `sequence` alias). */
export function resolveSpiritSequence(
  spirit?: SpiritBlockPrescription | null,
): FlowAsanaPrescription[] {
  const items = spirit?.asanas ?? spirit?.sequence;
  if (!items?.length) return [];
  return [...items].sort((a, b) => a.order - b.order);
}
