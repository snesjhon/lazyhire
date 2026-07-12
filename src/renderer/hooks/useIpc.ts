import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    api: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      on(channel: string, callback: (...args: unknown[]) => void): () => void;
    };
  }
}

export function useInvoke<TResult, TArgs = void>(channel: string) {
  const [data, setData] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(
    async (args?: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = args !== undefined
          ? await window.api.invoke(channel, args)
          : await window.api.invoke(channel);
        setData(result as TResult);
        return result as TResult;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [channel],
  );

  return { data, loading, error, invoke };
}

export function useIpcEvent<T>(channel: string, handler: (payload: T) => void): void {
  useEffect(() => {
    const unsubscribe = window.api.on(channel, handler as (...args: unknown[]) => void);
    return unsubscribe;
  }, [channel, handler]);
}
