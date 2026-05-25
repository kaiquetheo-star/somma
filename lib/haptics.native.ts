import * as Haptics from 'expo-haptics';

export async function hapticSetLogged(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export async function hapticRestTick(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export async function hapticRestComplete(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function hapticPhaseChange(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export async function hapticRoundEnd(): Promise<void> {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
