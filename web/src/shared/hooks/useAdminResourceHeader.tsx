import { Button } from "@douyinfe/semi-ui";
import { Plus, RefreshCw } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { useAdminHeaderActions } from "../../app/layouts/AdminLayout";


type AdminResourceHeaderOptions = {
  createLabel: string;
  refreshLabel: string;
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
  extraActions?: ReactNode;
};

export function useAdminResourceHeader({
  createLabel,
  refreshLabel,
  loading,
  onCreate,
  onRefresh,
  extraActions,
}: AdminResourceHeaderOptions) {
  const setHeaderActions = useAdminHeaderActions();

  useEffect(() => {
    setHeaderActions(
      <>
        {extraActions}
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading} aria-label={refreshLabel} />
        <Button icon={<Plus size={16} />} theme="solid" type="danger" onClick={onCreate}>
          {createLabel}
        </Button>
      </>,
    );
    return () => setHeaderActions(null);
  }, [createLabel, extraActions, loading, onCreate, onRefresh, refreshLabel, setHeaderActions]);
}
