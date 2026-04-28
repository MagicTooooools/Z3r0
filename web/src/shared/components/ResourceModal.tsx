import { Button, Modal } from "@douyinfe/semi-ui";
import { FormEvent, ReactNode } from "react";

type ResourceModalProps = {
  open: boolean;
  title: string;
  saving: boolean;
  submitLabel: string;
  width?: number;
  onCancel: () => void;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
};

export function ResourceModal({
  open,
  title,
  saving,
  submitLabel,
  width = 520,
  onCancel,
  onSubmit,
  children,
}: ResourceModalProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <Modal title={title} visible={open} onCancel={onCancel} footer={null} width={width} maskClosable={!saving}>
      <form className="resource-form" onSubmit={handleSubmit}>
        {children}
        <div className="modal-actions">
          <Button onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button htmlType="submit" theme="solid" type="danger" loading={saving}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
