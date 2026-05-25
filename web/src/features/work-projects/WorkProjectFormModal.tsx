import { Input, Select, Spin, Tag, TextArea } from "@douyinfe/semi-ui";
import { FolderKanban, ScanSearch, Server, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getWorkProjectTypes, isWorkProjectType } from "../../shared/api/contract";
import { showApiError } from "../../shared/api/feedback";
import { queryAvailableSandboxContainers } from "../../shared/api/sandboxContainers";
import { querySystemUsers } from "../../shared/api/systemUsers";
import type {
  CreateWorkProjectRequest,
  SandboxContainer,
  SystemUser,
  WorkProject,
} from "../../shared/api/types";
import { ResourceModal } from "../../shared/components/ResourceModal";
import {
  SANDBOX_CONTAINER_STATUS_COLOR,
  SANDBOX_CONTAINER_STATUS_LABEL,
  WORK_PROJECT_TYPE_LABEL,
} from "../../shared/lib/labels";

type WorkProjectFormModalProps = {
  open: boolean;
  saving: boolean;
  project?: WorkProject | null;
  onCancel: () => void;
  onSubmit: (payload: CreateWorkProjectRequest) => Promise<void>;
};

type SelectedOption = {
  value?: SystemUser["id"];
};

const EMPTY: CreateWorkProjectRequest = {
  name: "",
  description: "",
  owner_user_ids: [],
  sandbox_container_id: null,
  assets_text: "",
  type: "penetration_test",
};

export function WorkProjectFormModal({ open, saving, project, onCancel, onSubmit }: WorkProjectFormModalProps) {
  const [values, setValues] = useState<CreateWorkProjectRequest>(EMPTY);
  const [sandboxContainers, setSandboxContainers] = useState<SandboxContainer[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const projectTypes = useMemo(() => getWorkProjectTypes(), []);
  const editing = Boolean(project);

  const loadSandboxContainers = useCallback(async () => {
    setSandboxLoading(true);
    try {
      const response = await queryAvailableSandboxContainers({ page: 1, size: 100, keyword: "" });
      setSandboxContainers(response.data?.items ?? []);
    } catch (error) {
      showApiError(error);
    } finally {
      setSandboxLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await querySystemUsers({ page: 1, size: 100, keyword: "" });
      setUsers(response.data?.items ?? []);
    } catch (error) {
      showApiError(error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setValues(project ? {
      name: project.name,
      description: project.description,
      owner_user_ids: project.owner_user_ids,
      sandbox_container_id: project.sandbox_container_id ?? null,
      assets_text: project.assets_text,
      type: project.type,
    } : EMPTY);
    void loadSandboxContainers();
    void loadUsers();
  }, [loadSandboxContainers, loadUsers, open, project]);

  const userOptionList = useMemo(() => users.map((user) => ({
    label: <UserOption user={user} />,
    value: user.id,
  })), [users]);

  const sandboxOptionList = useMemo(() => sandboxContainers.map((container) => ({
    label: <SandboxContainerOption container={container} />,
    value: container.id,
  })), [sandboxContainers]);
  const selectedSandbox = sandboxContainers.find((container) => container.id === values.sandbox_container_id);

  const submit = () => onSubmit({
    ...values,
    name: values.name.trim(),
    description: values.description.trim(),
  });

  return (
    <ResourceModal
      open={open}
      title={editing ? "Edit Work Project" : "Create Work Project"}
      saving={saving}
      submitLabel={editing ? "Save" : "Create"}
      width={720}
      onCancel={onCancel}
      onSubmit={submit}
    >
      <div className="project-form-grid">
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
          <span>Owners</span>
          <Select
            prefix={<UserRound size={16} />}
            value={values.owner_user_ids}
            optionList={userOptionList}
            placeholder={usersLoading ? "Loading users" : "Select project owners"}
            emptyContent={usersLoading ? <Spin size="small" /> : "No users"}
            loading={usersLoading}
            multiple
            renderSelectedItem={(option: SelectedOption) => ({
              isRenderInTag: true,
              content: users.find((user) => user.id === option.value)?.username ?? String(option.value ?? ""),
            })}
            showClear
            onClear={() => setValues((v) => ({ ...v, owner_user_ids: [] }))}
            onChange={(value) => setValues((v) => ({
              ...v,
              owner_user_ids: Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [],
            }))}
          />
        </label>
        <label>
          <span>Sandbox Container</span>
          <Select
            prefix={<Server size={16} />}
            value={values.sandbox_container_id ?? undefined}
            optionList={sandboxOptionList}
            placeholder={sandboxLoading ? "Loading sandbox containers" : "Select sandbox container"}
            emptyContent={sandboxLoading ? <Spin size="small" /> : "No running sandbox containers"}
            loading={sandboxLoading}
            showClear
            renderSelectedItem={() => selectedSandbox ? selectedSandbox.container_name : ""}
            onClear={() => setValues((v) => ({ ...v, sandbox_container_id: null }))}
            onChange={(value) => setValues((v) => ({ ...v, sandbox_container_id: typeof value === "number" ? value : null }))}
          />
        </label>
      </div>

      <label>
        <span>Description</span>
        <TextArea value={values.description} maxLength={2000} autosize={{ minRows: 3, maxRows: 6 }}
          onChange={(description) => setValues((v) => ({ ...v, description }))}
        />
      </label>

      <label>
        <span>Assets</span>
        <TextArea
          className="project-assets-textarea"
          value={values.assets_text}
          maxLength={20000}
          onChange={(assets_text) => setValues((v) => ({ ...v, assets_text }))}
        />
      </label>
    </ResourceModal>
  );
}

function UserOption({ user }: { user: SystemUser }) {
  return (
    <div className="project-user-option">
      <span>{user.username}</span>
      <small>{user.email || "No email"}</small>
      <Tag color={user.role === "admin" ? "red" : "blue"}>{user.role}</Tag>
    </div>
  );
}

function SandboxContainerOption({ container }: { container: SandboxContainer }) {
  return (
    <div className="project-sandbox-option">
      <span>{container.container_name}</span>
      <small>ID: {container.id} · {container.container_hash || "Pending hash"}</small>
      <Tag color={SANDBOX_CONTAINER_STATUS_COLOR[container.status]}>
        {SANDBOX_CONTAINER_STATUS_LABEL[container.status]}
      </Tag>
    </div>
  );
}
