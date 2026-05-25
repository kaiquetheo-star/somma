/** Web PWA — haptics unavailable; no-op so export never pulls expo-haptics native code. */
export async function hapticSetLogged(): Promise<void> {}

export async function hapticRestTick(): Promise<void> {}

export async function hapticRestComplete(): Promise<void> {}

export async function hapticPhaseChange(): Promise<void> {}

export async function hapticRoundEnd(): Promise<void> {}
