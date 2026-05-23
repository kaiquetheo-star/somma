import type { VisualAssetType } from '@/types/catalog';

/** Matte Gold · Quiet Luxury accent */
export const MOVEMENT_VISUAL_GOLD = '#BFA06A';

/** Soft Silver · secondary accent */
export const MOVEMENT_VISUAL_SILVER = '#E1E8E4';

export type MovementVisualAccent = 'gold' | 'silver';

export type ModularPlaybackMode = 'video' | 'image' | null;

const VIDEO_TYPES = new Set<VisualAssetType>(['mp4', 'webm']);
const IMAGE_TYPES = new Set<VisualAssetType>(['gif', 'webp']);

function extensionFromUrl(url: string): string | null {
  const path = url.split('?')[0]?.split('#')[0] ?? '';
  const segment = path.split('.').pop()?.toLowerCase();
  return segment && segment.length <= 5 ? segment : null;
}

/** Infer renderer type from a public Storage / CDN URL when DB type is missing. */
export function inferVisualAssetTypeFromUrl(url: string): VisualAssetType | null {
  const ext = extensionFromUrl(url);
  if (ext === 'mp4' || ext === 'webm' || ext === 'gif' || ext === 'webp') {
    return ext;
  }
  return null;
}

function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Resolve whether the modular player should stream video or render a static/animated image.
 * Legacy bundled lottie/svg paths return null — placeholder typography is shown instead.
 */
export function resolveModularPlaybackMode(
  url: string | null | undefined,
  type: VisualAssetType | null | undefined,
): ModularPlaybackMode {
  if (!url?.trim()) return null;

  const trimmed = url.trim();
  if (!isRemoteUrl(trimmed)) return null;

  const resolvedType = type ?? inferVisualAssetTypeFromUrl(trimmed);
  if (!resolvedType) return null;
  if (VIDEO_TYPES.has(resolvedType)) return 'video';
  if (IMAGE_TYPES.has(resolvedType)) return 'image';
  return null;
}

export function hasModularMovementAsset(
  url: string | null | undefined,
  type: VisualAssetType | null | undefined,
): boolean {
  return resolveModularPlaybackMode(url, type) != null;
}

/** @deprecated Use hasModularMovementAsset — kept for transitional imports */
export function hasMovementVisual(
  url: string | null | undefined,
  type: VisualAssetType | null | undefined,
): boolean {
  return hasModularMovementAsset(url, type);
}
