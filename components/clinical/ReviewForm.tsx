import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { ClinicalExitInterview } from '@/types/clinical';

const OBSIDIAN = '#0A0E0C';
const MATTE_GOLD = '#BFA06A';
const MUTED = '#6B7568';

export interface ReviewFormProps {
  title?: string;
  description?: string;
  onSubmit: (interview: ClinicalExitInterview) => void;
}

/** End-of-Month Clinical Exit Interview — Month 2 load calibration */
export function ReviewForm({ title, description, onSubmit }: ReviewFormProps) {
  const [averageRpe, setAverageRpe] = useState('');
  const [perceivedFatigue, setPerceivedFatigue] = useState('');
  const [estimated1rm, setEstimated1rm] = useState('');

  const fatigueValue = perceivedFatigue.trim() ? Number(perceivedFatigue) : null;
  const rpeValue = averageRpe.trim() ? Number(averageRpe) : null;

  const canSubmit =
    rpeValue != null &&
    Number.isFinite(rpeValue) &&
    rpeValue >= 1 &&
    rpeValue <= 10 &&
    fatigueValue != null &&
    Number.isFinite(fatigueValue) &&
    fatigueValue >= 1 &&
    fatigueValue <= 10;

  const handleSubmit = () => {
    if (!canSubmit || rpeValue == null || fatigueValue == null) return;
    const oneRm = estimated1rm.trim() ? Number(estimated1rm) : null;
    onSubmit({
      average_rpe: Math.round(rpeValue * 10) / 10,
      perceived_fatigue: Math.round(fatigueValue),
      estimated_1rm_kg:
        oneRm != null && Number.isFinite(oneRm) && oneRm > 0 ? Math.round(oneRm * 10) / 10 : null,
      submitted_at: new Date().toISOString(),
    });
  };

  return (
    <View
      className="rounded-2xl border px-6 py-6"
      style={{ borderColor: 'rgba(191,160,106,0.35)', backgroundColor: OBSIDIAN }}
    >
      <Text
        className="font-body text-[10px] uppercase tracking-[0.45em]"
        style={{ color: MATTE_GOLD }}
      >
        Clinical Exit Interview
      </Text>
      <Text className="mt-3 font-display text-2xl text-white/95">
        {title ?? 'Month 1 Review'}
      </Text>
      <Text className="mt-2 font-body text-sm leading-6" style={{ color: MUTED }}>
        {description ??
          'Submit honest averages from Month 1. Month 2 target loads will anchor to your reported strength, not estimates alone.'}
      </Text>

      <View className="mt-6 gap-4">
        <Field
          label="Average RPE (1–10)"
          value={averageRpe}
          onChangeText={setAverageRpe}
          keyboardType="decimal-pad"
          placeholder="e.g. 7.5"
        />
        <Field
          label="Perceived Fatigue (1–10)"
          value={perceivedFatigue}
          onChangeText={setPerceivedFatigue}
          keyboardType="number-pad"
          placeholder="e.g. 6"
        />
        <Field
          label="Current 1RM Estimate (kg, optional)"
          value={estimated1rm}
          onChangeText={setEstimated1rm}
          keyboardType="decimal-pad"
          placeholder="Primary lift — e.g. 100"
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        className="mt-8 items-center rounded-xl border py-4 active:opacity-85"
        style={{
          borderColor: canSubmit ? MATTE_GOLD : 'rgba(255,255,255,0.1)',
          opacity: canSubmit ? 1 : 0.45,
        }}
      >
        <Text
          className="font-body text-xs uppercase tracking-[0.35em]"
          style={{ color: canSubmit ? MATTE_GOLD : MUTED }}
        >
          Lock Month 2 Protocol
        </Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType: 'decimal-pad' | 'number-pad';
  placeholder: string;
}) {
  return (
    <View>
      <Text className="font-body text-[10px] uppercase tracking-[0.3em] text-white/45">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        className="mt-2 rounded-lg border px-4 py-3 font-body text-base text-white/90"
        style={{
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      />
    </View>
  );
}
