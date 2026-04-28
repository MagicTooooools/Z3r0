import { Input, Select, TextArea } from "@douyinfe/semi-ui";
import { FolderKanban, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getWorkProjectTypes, isWorkProjectType } from "../../shared/api/contract";
import type { CreateWorkProjectRequest } from "../../shared/api/types";
import { ResourceModal } from "../../shared/components/ResourceModal";
import { WORK_PROJECT_TYPE_LABEL } from "../../shared/lib/labels";

type WorkProjectFormModalProps = {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateWorkProjectRequest) => Promise<void>;
};

const EMPTY: CreateWorkProjectRequest = { name: "", description: "", type: "penetration_test" };

export function WorkProjectFormModal({ open, saving, onCancel, onSubmit }: WorkProjectFormModalProps) {
  const [values, setValues] = useState<CreateWorkProjectRequest>(EMPTY);
  const projectTypes = useMemo(() => getWorkProjectTypes(), []);

  useEffect(() => {
    if (open) setValues(EMPTY);
  }, [open]);

  const submit = () => onSubmit({
    name: values.name.trim(),
    description: values.description.trim(),
    type: values.type,
  });

  return (
    <ResourceModal
      open={open}
      title="Create Work Project"
      saving={saving}
      submitLabel="Create"
      width={560}
      onCancel={onCancel}
      onSubmit={submit}
    >
      <label>
        <span>Name</span>
        <Input prefix={<FolderKanban size={16} />} value={values.name} maxLength={255} required
          onChange={(name) => setValues((v) => ({ ...v, name }))}
        />
      </label>
      <label>
        <span>Type</span>
        <Select prefix={<ScanSearch size={16} />} value={values.type}
          onChange={(type) => isWorkProjectType(type) && setValues((v) => ({ ...v, type }))}
          optionList={projectTypes.map((type) => ({ label: WORK_PROJECT_TYPE_LABEL[type], value: type }))}
        />
      </label>
      <label>
        <span>Description</span>
        <TextArea value={values.description} maxLength={2000} autosize={{ minRows: 3, maxRows: 6 }}
          onChange={(description) => setValues((v) => ({ ...v, description }))}
        />
      </label>
    </ResourceModal>
  );
}
