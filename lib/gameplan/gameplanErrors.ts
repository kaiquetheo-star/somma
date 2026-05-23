export class GameplanFetchError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly catalogCounts?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      code?: string;
      status?: number;
      catalogCounts?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'GameplanFetchError';
    this.code = options?.code ?? 'GAMEPLAN_FETCH_FAILED';
    this.status = options?.status;
    this.catalogCounts = options?.catalogCounts;
    if (options?.cause != null) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isGameplanFetchError(error: unknown): error is GameplanFetchError {
  return error instanceof GameplanFetchError;
}
