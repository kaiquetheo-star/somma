/** Web export — combat audio cues optional; avoid expo-audio native graph in Metro web bundle. */

export async function prepareCombatAudio(): Promise<void> {}

export function releaseCombatAudio(): void {}

export async function playRoundBell(): Promise<void> {}

export async function playTenSecondWarning(): Promise<void> {}

/** @deprecated use prepareCombatAudio */
export const prepareWorkoutAudio = prepareCombatAudio;

/** @deprecated use playRoundBell */
export const playPhaseCue = playRoundBell;
