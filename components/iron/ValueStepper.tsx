import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { webTextInputProps } from '@/lib/ux/webTextInput';

interface ValueStepperProps {
  label: string;
  value: number;
  unit?: string;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Allow typing the value directly (required for web load entry) */
  allowDirectInput?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatDisplay(value: number, step: number): string {
  return step < 1
    ? value.toFixed(1)
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1);
}

export function ValueStepper({
  label,
  value,
  unit,
  step,
  min = 0,
  max = 999,
  onChange,
  disabled = false,
  allowDirectInput = false,
}: ValueStepperProps) {
  const [draft, setDraft] = useState(formatDisplay(value, step));

  useEffect(() => {
    setDraft(formatDisplay(value, step));
  }, [value, step]);

  const decrement = () => onChange(clamp(Math.round((value - step) * 10) / 10, min, max));
  const increment = () => onChange(clamp(Math.round((value + step) * 10) / 10, min, max));

  const commitDraft = (text: string) => {
    const normalized = text.replace(',', '.').trim();
    if (normalized === '' || normalized === '.') {
      setDraft(formatDisplay(value, step));
      return;
    }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      setDraft(formatDisplay(value, step));
      return;
    }
    const next = clamp(parsed, min, max);
    onChange(next);
    setDraft(formatDisplay(next, step));
  };

  return (
    <View className={disabled ? 'opacity-50' : ''} style={{ zIndex: 2 }}>
      <Text className="text-center font-body text-[10px] uppercase tracking-[0.4em] text-[#6B7568]">
        {label}
      </Text>
      <View className="mt-3 flex-row items-center justify-center gap-6">
        <Pressable
          onPress={decrement}
          disabled={disabled}
          accessibilityLabel={`Decrease ${label}`}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/15 active:bg-white/10"
        >
          <Text className="font-body-medium text-2xl text-[#E8E4DC]">−</Text>
        </Pressable>

        <View className="min-w-[100px] items-center" pointerEvents="box-none">
          {allowDirectInput ? (
            <View className="flex-row items-baseline justify-center gap-1">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onBlur={() => commitDraft(draft)}
                onSubmitEditing={() => commitDraft(draft)}
                editable={!disabled}
                keyboardType={Platform.OS === 'web' ? 'default' : 'decimal-pad'}
                inputMode="decimal"
                selectTextOnFocus
                accessibilityLabel={label}
                placeholder="0"
                placeholderTextColor="#4A5D44"
                className="min-w-[72px] text-center font-display-bold text-5xl text-[#E8E4DC]"
                style={
                  Platform.OS === 'web'
                    ? ({
                        outlineStyle: 'none',
                        padding: 0,
                        margin: 0,
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        cursor: disabled ? 'not-allowed' : 'text',
                      } as object)
                    : undefined
                }
                {...webTextInputProps()}
              />
              {unit ? (
                <Text className="font-body text-lg text-matte-gold/80">{unit}</Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text className="font-display-bold text-5xl text-[#E8E4DC]">
                {formatDisplay(value, step)}
              </Text>
              {unit ? (
                <Text className="mt-1 font-body text-xs text-matte-gold/80">{unit}</Text>
              ) : null}
            </>
          )}
        </View>

        <Pressable
          onPress={increment}
          disabled={disabled}
          accessibilityLabel={`Increase ${label}`}
          className="h-12 w-12 items-center justify-center rounded-full border border-white/15 active:bg-white/10"
        >
          <Text className="font-body-medium text-2xl text-[#E8E4DC]">+</Text>
        </Pressable>
      </View>
      {allowDirectInput && !disabled ? (
        <Text className="mt-2 text-center font-body text-[10px] text-[#6B7568]">
          Tap to type · use − / + to step
        </Text>
      ) : null}
    </View>
  );
}
