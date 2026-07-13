type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

type CachedAsyncOptions<T> = {
  forceRefresh?: boolean;
  shouldCache?: (value: T) => boolean;
};

const valueCache = new Map<string, CacheEntry>();
const pendingCache = new Map<string, Promise<unknown>>();

/**
 * 같은 키의 완료 결과는 TTL 동안 재사용하고, 동시에 들어온 동일 요청은 하나의 Promise로 합친다.
 * 앱 프로세스 메모리 캐시이므로 로그아웃/새로고침 후에는 자연스럽게 초기화된다.
 */
export async function getCachedAsync<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options: CachedAsyncOptions<T> = {},
): Promise<T> {
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = valueCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value as T;

    if (cached) valueCache.delete(key);

    const pending = pendingCache.get(key);
    if (pending) return pending as Promise<T>;
  }

  const request = loader()
    .then((value) => {
      if (options.shouldCache?.(value) !== false) {
        valueCache.set(key, {
          value,
          expiresAt: Date.now() + Math.max(0, ttlMs),
        });
      }
      return value;
    })
    .finally(() => {
      if (pendingCache.get(key) === request) pendingCache.delete(key);
    });

  pendingCache.set(key, request);
  return request;
}

export function invalidateAsyncCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    valueCache.clear();
    pendingCache.clear();
    return;
  }

  for (const key of valueCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix))
      valueCache.delete(key);
  }
}
