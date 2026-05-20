export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if ((status === 429 || status === 503) && attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: unreachable');
}
