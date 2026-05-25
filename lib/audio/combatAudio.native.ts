import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import {
  COMBAT_AUDIO_ASSETS,
  type CombatCueKey,
} from '@/lib/audio/combatAudioAssets';

let sessionReady = false;
let preparing: Promise<void> | null = null;
const players = new Map<CombatCueKey, AudioPlayer>();

async function ensureSession(): Promise<void> {
  if (sessionReady) return;
  if (preparing) {
    await preparing;
    return;
  }

  preparing = (async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
      });

      for (const key of Object.keys(COMBAT_AUDIO_ASSETS) as CombatCueKey[]) {
        if (players.has(key)) continue;
        const player = createAudioPlayer(COMBAT_AUDIO_ASSETS[key]);
        player.volume = key === 'roundBell' ? 0.85 : 0.65;
        players.set(key, player);
      }

      sessionReady = true;
    } catch {
      // Audio optional — haptics still fire
    } finally {
      preparing = null;
    }
  })();

  await preparing;
}

async function playCachedCue(key: CombatCueKey): Promise<void> {
  try {
    await ensureSession();
    const player = players.get(key);
    if (!player) return;
    player.seekTo(0);
    player.play();
  } catch {
    // Player not ready
  }
}

/** Prepare combat cue players — call once when entering combat screen */
export async function prepareCombatAudio(): Promise<void> {
  await ensureSession();
}

/** Release all cached players — call on combat screen unmount */
export function releaseCombatAudio(): void {
  for (const player of players.values()) {
    try {
      player.release();
    } catch {
      // Already released
    }
  }
  players.clear();
  sessionReady = false;
  preparing = null;
}

/** Distinct bell for round start / round end */
export async function playRoundBell(): Promise<void> {
  await playCachedCue('roundBell');
}

/** Double pulse in the final 10 seconds of a work round */
export async function playTenSecondWarning(): Promise<void> {
  await playCachedCue('tenSecondWarning');
  setTimeout(() => {
    void playCachedCue('tenSecondWarning');
  }, 280);
}

/** @deprecated use prepareCombatAudio */
export const prepareWorkoutAudio = prepareCombatAudio;

/** @deprecated use playRoundBell */
export const playPhaseCue = playRoundBell;
