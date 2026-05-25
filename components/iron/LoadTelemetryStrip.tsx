import { useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  computeTrainingLoadSnapshot,
  formatIronAcwrThresholdCaption,
  formatPillarTelemetryLine,
  type LoadTelemetryPillar,
} from '@/lib/physics/loadTelemetry';
import type { PerformanceLogEntry } from '@/types/performance';

const PILLAR_ORDER: LoadTelemetryPillar[] = ['iron', 'combat', 'spirit'];

interface LoadTelemetryStripProps {
  performanceLogs: PerformanceLogEntry[];
  goalIron?: string | null;
  /** Richer copy on Biological Passport / Analytics */
  variant?: 'compact' | 'detail';
}

/** Quiet Luxury internal load readout — ACWR & RPE variability per pillar */
export function LoadTelemetryStrip({
  performanceLogs,
  goalIron = null,
  variant = 'compact',
}: LoadTelemetryStripProps) {
  const snapshot = useMemo(
    () => computeTrainingLoadSnapshot(performanceLogs, { goalIron }),
    [performanceLogs, goalIron],
  );

  const hasData = PILLAR_ORDER.some((pillar) => snapshot.pillars[pillar].sessionCount > 0);
  const ironHasSessions = snapshot.pillars.iron.sessionCount > 0;

  if (!hasData) {
    return (
      <View className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
        <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
          Internal load telemetry
        </Text>
        <Text className="mt-2 font-body text-xs leading-5 text-[#8A9488]">
          Log iron sets with RIR and combat sessions to unlock ACWR and RPE variability — $0,
          on-device only.
        </Text>
        {variant === 'detail' ? (
          <Text className="mt-3 font-body text-[10px] uppercase tracking-[0.22em] text-[#6B7568]">
            {formatIronAcwrThresholdCaption(snapshot.ironAcwrThresholds)}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-white/10 bg-[#0A0E0C] px-5 py-5">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
        Internal load telemetry
      </Text>
      {snapshot.globalRpeMean != null ? (
        <Text className="mt-2 font-body text-xs text-matte-gold/90">
          Global RPE {snapshot.globalRpeMean.toFixed(1)} · 14d window
        </Text>
      ) : null}
      {(variant === 'detail' || ironHasSessions) && (
        <Text className="mt-2 font-body text-[10px] uppercase tracking-[0.22em] text-[#6B7568]">
          {formatIronAcwrThresholdCaption(snapshot.ironAcwrThresholds)}
        </Text>
      )}
      {variant === 'detail' ? (
        <Text className="mt-2 font-body text-xs leading-5 text-[#8A9488]">
          Iron ACWR bands follow your strength goal. Combat uses conditioning defaults (spike ≥
          1.50).
        </Text>
      ) : null}
      <View className="mt-4 gap-2">
        {PILLAR_ORDER.map((pillar) => {
          const metrics = snapshot.pillars[pillar];
          if (metrics.sessionCount === 0) return null;
          const elevated =
            metrics.acwrStatus === 'spike' || metrics.acwrStatus === 'elevated';
          return (
            <Text
              key={pillar}
              className={`font-body text-[10px] uppercase tracking-[0.22em] ${
                elevated ? 'text-matte-gold' : 'text-[#8A9488]'
              }`}
            >
              {formatPillarTelemetryLine(metrics)}
            </Text>
          );
        })}
      </View>
      {variant === 'detail' && snapshot.pillars.iron.sRpe7d > 0 ? (
        <Text className="mt-4 font-body text-[10px] uppercase tracking-[0.2em] text-[#6B7568]">
          Iron sRPE 7d · {snapshot.pillars.iron.sRpe7d} · vol{' '}
          {snapshot.pillars.iron.volume7d.toLocaleString()}
          {snapshot.pillars.iron.volume7d > 0 ? ' kg·reps' : ''}
        </Text>
      ) : null}
    </View>
  );
}
