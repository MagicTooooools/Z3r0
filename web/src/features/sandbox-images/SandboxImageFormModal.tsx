import { Input } from "@douyinfe/semi-ui";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import type { CreateSandboxImageRequest } from "../../shared/api/types";
import { ResourceModal } from "../../shared/components/ResourceModal";

type SandboxImageFormModalProps = {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateSandboxImageRequest) => Promise<void>;
};

const EMPTY: CreateSandboxImageRequest = { image_name: "" };

export function SandboxImageFormModal({ open, saving, onCancel, onSubmit }: SandboxImageFormModalProps) {
  const [values, setValues] = useState<CreateSandboxImageRequest>(EMPTY);

  useEffect(() => {
    if (open) setValues(EMPTY);
  }, [open]);

  return (
    <ResourceModal
      open={open}
      title="Create Sandbox Image"
      saving={saving}
      submitLabel="Create"
      onCancel={onCancel}
      onSubmit={() => onSubmit({ image_name: values.image_name.trim() })}
    >
      <label>
        <span>Image Name</span>
        <Input prefix={<Package size={16} />} value={values.image_name}
          placeholder="ghcr.io/org/image:latest" maxLength={255} required
          onChange={(image_name) => setValues({ image_name })}
        />
      </label>
    </ResourceModal>
  );
}
