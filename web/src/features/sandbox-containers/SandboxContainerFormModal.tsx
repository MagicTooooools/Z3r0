import { Button, InputNumber, Select, TextArea } from "@douyinfe/semi-ui";
import { Boxes, Plug, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CreateSandboxContainerRequest, SandboxContainerPortMapping, SandboxImage } from "../../shared/api/types";
import { SANDBOX_CONTAINER_DEFAULT_COMMAND } from "../../shared/api/generated/constants";
import { ResourceModal } from "../../shared/components/ResourceModal";

type SandboxContainerProtocol = SandboxContainerPortMapping["protocol"];

type PortMappingFormValue = {
  id: string;
  container_port: number;
  host_port: number;
  protocol: SandboxContainerProtocol;
};

type SandboxContainerFormModalProps = {
  open: boolean;
  saving: boolean;
  images: SandboxImage[];
  imagesLoading: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateSandboxContainerRequest) => Promise<void>;
};

const PROTOCOL_OPTIONS = [
  { label: "TCP", value: "tcp" },
  { label: "UDP", value: "udp" },
];

function createEmptyMapping(): PortMappingFormValue {
  return {
    id: crypto.randomUUID(),
    container_port: 8080,
    host_port: 8080,
    protocol: "tcp",
  };
}

export function SandboxContainerFormModal({
  open,
  saving,
  images,
  imagesLoading,
  onCancel,
  onSubmit,
}: SandboxContainerFormModalProps) {
  const readyImages = useMemo(() => images.filter((image) => image.status === "ready"), [images]);
  const [imageId, setImageId] = useState<number | undefined>();
  const [containerCommand, setContainerCommand] = useState(SANDBOX_CONTAINER_DEFAULT_COMMAND);
  const [portMappings, setPortMappings] = useState<PortMappingFormValue[]>([]);

  useEffect(() => {
    if (!open) return;
    setImageId(readyImages[0]?.id);
    setContainerCommand(SANDBOX_CONTAINER_DEFAULT_COMMAND);
    setPortMappings([]);
  }, [open, readyImages]);

  const submit = () => onSubmit({
    image_id: imageId || 0,
    container_command: containerCommand.trim() || SANDBOX_CONTAINER_DEFAULT_COMMAND,
    port_mappings: portMappings.map(({ container_port, host_port, protocol }) => ({
      container_port,
      host_port,
      protocol,
    })),
  });

  const updateMapping = (id: string, patch: Partial<PortMappingFormValue>) => {
    setPortMappings((current) => current.map((mapping) => (
      mapping.id === id ? { ...mapping, ...patch } : mapping
    )));
  };

  return (
    <ResourceModal
      open={open}
      title="Create Sandbox Container"
      saving={saving}
      submitLabel="Create"
      submitDisabled={!imageId}
      width={640}
      onCancel={onCancel}
      onSubmit={submit}
    >
      <label>
        <span>Image</span>
        <Select
          prefix={<Boxes size={16} />}
          value={imageId}
          loading={imagesLoading}
          disabled={readyImages.length === 0}
          placeholder="Select a ready sandbox image"
          onChange={(value) => typeof value === "number" && setImageId(value)}
          optionList={readyImages.map((image) => ({ label: image.image_name, value: image.id }))}
        />
      </label>

      <label>
        <span>Command</span>
        <TextArea
          value={containerCommand}
          maxLength={2000}
          autosize={{ minRows: 3, maxRows: 6 }}
          onChange={setContainerCommand}
        />
      </label>

      <div className="port-mapping-fieldset">
        <div className="port-mapping-heading">
          <span>Port Mappings</span>
          <Button icon={<Plus size={14} />} theme="borderless" onClick={() => setPortMappings((current) => [...current, createEmptyMapping()])}>
            Add
          </Button>
        </div>
        {portMappings.length === 0 ? (
          <div className="port-mapping-empty">No exposed ports</div>
        ) : portMappings.map((mapping) => (
          <div className="port-mapping-row" key={mapping.id}>
            <InputNumber
              prefix={<Plug size={14} />}
              value={mapping.host_port}
              min={1}
              max={65535}
              onChange={(value) => typeof value === "number" && updateMapping(mapping.id, { host_port: value })}
            />
            <span className="port-arrow">to</span>
            <InputNumber
              value={mapping.container_port}
              min={1}
              max={65535}
              onChange={(value) => typeof value === "number" && updateMapping(mapping.id, { container_port: value })}
            />
            <Select
              value={mapping.protocol}
              optionList={PROTOCOL_OPTIONS}
              onChange={(value) => (value === "tcp" || value === "udp") && updateMapping(mapping.id, { protocol: value })}
            />
            <Button
              icon={<Trash2 size={14} />}
              theme="borderless"
              type="danger"
              aria-label="Remove port mapping"
              onClick={() => setPortMappings((current) => current.filter((item) => item.id !== mapping.id))}
            />
          </div>
        ))}
      </div>
    </ResourceModal>
  );
}
