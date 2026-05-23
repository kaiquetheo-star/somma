import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MOVEMENT_VISUAL_GOLD,
  MOVEMENT_VISUAL_SILVER,
  resolveModularPlaybackMode,
  type MovementVisualAccent,
} from '@/lib/visual/resolveMovementSource';
import type { VisualAssetType } from '@/types/catalog';

const OBSIDIAN_FADE = '#0A0E0C';
const DEFAULT_HEIGHT = 200;

export interface ModularMovementPlayerProps {
  url?: string | null;
  type?: VisualAssetType | null;
  /** Shown in placeholder and as overlay label when media is playing */
  movementName?: string;
  subtitle?: string;
  accent?: MovementVisualAccent;
  height?: number;
  className?: string;
}

interface MovementVideoLayerProps {
  uri: string;
  height: number;
}

/** Isolated so `useVideoPlayer` is only mounted when a video URL is present. */
function MovementVideoLayer({ uri, height }: MovementVideoLayerProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height }}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      allowsFullscreen={false}
    />
  );
}

function MovementPlaceholder({
  movementName,
  subtitle,
  accentColor,
  height,
}: {
  movementName?: string;
  subtitle?: string;
  accentColor: string;
  height: number;
}) {
  return (
    <View
      className="w-full items-center justify-center px-6"
      style={{ height, backgroundColor: 'rgba(10, 14, 12, 0.92)' }}
    >
      <View className="mb-3 h-px w-14" style={{ backgroundColor: `${accentColor}66` }} />
      <Text
        className="font-body text-[10px] uppercase tracking-[0.4em]"
        style={{ color: `${accentColor}B3` }}
      >
        Movement reference
      </Text>
      <Text className="mt-3 text-center font-display text-xl leading-8 text-[#E8E4DC]">
        {movementName?.trim() || 'Prescribed movement'}
      </Text>
      {subtitle ? (
        <Text className="mt-2 text-center font-body text-xs leading-5 text-[#8A9488]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * SHRED-style modular loop player — muted MP4 via expo-video, animated WebP/GIF via expo-image.
 * Obsidian gradient wash fades the media into the Sanctuary background.
 */
export function ModularMovementPlayer({
  url,
  type,
  movementName,
  subtitle,
  accent = 'gold',
  height = DEFAULT_HEIGHT,
  className,
}: ModularMovementPlayerProps) {
  const accentColor = accent === 'gold' ? MOVEMENT_VISUAL_GOLD : MOVEMENT_VISUAL_SILVER;

  const playbackMode = useMemo(
    () => resolveModularPlaybackMode(url, type),
    [url, type],
  );

  const mediaUri = url?.trim() ?? '';

  return (
    <View className={`w-full overflow-hidden ${className ?? ''}`}>
      <View
        className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08]"
        style={{ height }}
      >
        {playbackMode === 'video' ? (
          <MovementVideoLayer uri={mediaUri} height={height} />
        ) : playbackMode === 'image' ? (
          <Image
            source={{ uri: mediaUri }}
            style={{ width: '100%', height }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <MovementPlaceholder
            movementName={movementName}
            subtitle={subtitle}
            accentColor={accentColor}
            height={height}
          />
        )}

        {playbackMode ? (
          <>
            <LinearGradient
              colors={['transparent', 'rgba(10, 14, 12, 0.45)', OBSIDIAN_FADE]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {movementName ? (
              <View
                className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8"
                pointerEvents="none"
              >
                <Text
                  className="font-body text-[9px] uppercase tracking-[0.35em]"
                  style={{ color: `${accentColor}99` }}
                >
                  Active movement
                </Text>
                <Text className="mt-1 font-display text-lg leading-7 text-[#E8E4DC]" numberOfLines={2}>
                  {movementName}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
