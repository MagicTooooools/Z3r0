import { Button } from "@douyinfe/semi-ui";
import { Plus, RefreshCw } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { useAdminHeaderActions } from "../../app/layouts/AdminLayout";


type AdminResourceHeaderOptions = {
  createLabel?: string;
  refreshLabel: string;
  loading: boolean;
  onCreate?: () => void;
  onRefresh: () => void;
  createIcon?: ReactNode;
  extraActions?: ReactNode;
  appendExtraActions?: boolean;
};

export function useAdminResourceHeader({
  createLabel,
  refreshLabel,
  loading,
  onCreate,
  onRefresh,
  createIcon,
  extraActions,
  appendExtraActions = false,
}: AdminResourceHeaderOptions) {
  const setHeaderActions = useAdminHeaderActions();

  useEffect(() => {
    const refreshButton = (
      <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading} aria-label={refreshLabel} />
    );
    const createButton = createLabel && onCreate ? (
      <Button icon={createIcon ?? <Plus size={16} />} theme="solid" type="danger" onClick={onCreate}>
        {createLabel}
      </Button>
    ) : null;

    setHeaderActions(
      <>
        {appendExtraActions ? null : extraActions}
        {refreshButton}
        {createButton}
        {appendExtraActions ? extraActions : null}
      </>,
    );
    return () => setHeaderActions(null);
  }, [
    appendExtraActions,
    createIcon,
    createLabel,
    extraActions,
    loading,
    onCreate,
    onRefresh,
    refreshLabel,
    setHeaderActions,
  ]);
}
