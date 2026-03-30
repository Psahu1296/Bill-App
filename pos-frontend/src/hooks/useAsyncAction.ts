import { useState, useCallback } from "react";
import { getErrorMessage } from "../utils";

export function useAsyncAction() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setIsPending(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(getErrorMessage(err));
      return undefined;
    } finally {
      setIsPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { isPending, error, clearError, execute } as const;
}
