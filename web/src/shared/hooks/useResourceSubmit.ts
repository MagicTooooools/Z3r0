import { useCallback, useState } from "react";
import { showApiError, showApiSuccess } from "../api/feedback";
import type { CommonResponsePayload } from "../api/types";


type ResourceSubmitOptions = {
  onSuccess?: () => void | Promise<void>;
};

export function useResourceSubmit({ onSuccess }: ResourceSubmitOptions = {}) {
  const [saving, setSaving] = useState(false);

  const submit = useCallback(
    async (action: () => Promise<CommonResponsePayload>) => {
      if (saving) return;
      setSaving(true);
      try {
        const response = await action();
        showApiSuccess(response);
        await onSuccess?.();
      } catch (error) {
        showApiError(error);
      } finally {
        setSaving(false);
      }
    },
    [onSuccess, saving],
  );

  return { saving, submit };
}
