import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

interface EmailAuthPanelProps {
  onCancel?: () => void;
}

export function EmailAuthPanel({ onCancel }: EmailAuthPanelProps) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendLink = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await signInWithEmail(trimmed);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <View className="gap-3 rounded-2xl border border-matte-gold/30 bg-matte-gold/5 px-5 py-5">
        <Text className="font-display text-xl text-matte-gold">Link dispatched</Text>
        <Text className="font-body text-sm leading-6 text-[#A8B0A4]">
          Open the email on this device and tap the link to enter SOMMA.
        </Text>
        {onCancel ? (
          <Pressable onPress={onCancel} className="mt-2 active:opacity-70">
            <Text className="font-body text-xs uppercase tracking-[0.3em] text-[#6B7568]">
              Dismiss
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5">
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-matte-gold/80">
        Email attunement
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@sanctuary.com"
        placeholderTextColor="#6B7568"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-xl border border-white/10 bg-obsidian px-4 py-3 font-body text-base text-[#E8E4DC]"
      />
      {error ? <Text className="font-body text-xs text-blood-red">{error}</Text> : null}
      <Pressable
        onPress={handleSendLink}
        disabled={isSending}
        className="rounded-xl border border-matte-gold/40 bg-matte-gold/10 py-4 active:opacity-80"
      >
        {isSending ? (
          <ActivityIndicator color="#BFA06A" />
        ) : (
          <Text className="text-center font-body-medium text-xs uppercase tracking-[0.25em] text-matte-gold">
            Send magic link
          </Text>
        )}
      </Pressable>
    </View>
  );
}
