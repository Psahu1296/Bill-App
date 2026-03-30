import { useState, useCallback } from "react";

export function useFormState<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial);

  const setField = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const reset = useCallback(() => setValues(initial), [initial]);

  return { values, setValues, setField, reset } as const;
}
