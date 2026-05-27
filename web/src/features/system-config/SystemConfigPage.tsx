import { Button, Input, InputNumber, Spin, Switch, TextArea } from "@douyinfe/semi-ui";
import { Bot, RotateCcw, Save, Settings, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getInstanceConfig, updateInstanceConfig } from "../../shared/api/systemConfig";
import { showApiError, showApiSuccess } from "../../shared/api/feedback";
import type {
  AgentConfig,
  AgentPoolConfig,
  AgentRuntimeConfig,
  InstanceConfig,
  UpdateInstanceConfigRequest,
} from "../../shared/api/types";
import { useAdminResourceHeader } from "../../shared/hooks/useAdminResourceHeader";

type AgentFormValue = AgentConfig & {
  rowId: string;
};

type ConfigFormValue = {
  agents: AgentFormValue[];
  agent_pool: AgentPoolConfig;
  agent_runtime: AgentRuntimeConfig;
};

const DEFAULT_AGENT_POOL: AgentPoolConfig = {
  max_size: 256,
  ttl_seconds: 1800,
  sweep_interval_seconds: 60,
};

const DEFAULT_AGENT_RUNTIME: AgentRuntimeConfig = {
  main_max_turns: 1000,
  subordinate_max_turns: 1000,
  model_stream_idle_timeout_seconds: 300,
  context_compression_enabled: true,
  context_compression_trigger_ratio: 0.95,
  context_compression_hard_stop_ratio: 0.98,
  context_compression_target_ratio: 0.2,
  context_compression_preserve_recent_ratio: 0.25,
  context_compression_preserve_recent_items: 20,
  context_compression_min_items: 12,
  context_compression_summary_max_tokens: 8000,
};

function toFormValue(config: InstanceConfig): ConfigFormValue {
  const agents = Object.entries(config.agents ?? {}).map(([code, agent]) => ({
    ...agent,
    code: agent.code || code,
    rowId: crypto.randomUUID(),
  }));
  return {
    agents,
    agent_pool: { ...DEFAULT_AGENT_POOL, ...(config.agent_pool ?? {}) },
    agent_runtime: { ...DEFAULT_AGENT_RUNTIME, ...(config.agent_runtime ?? {}) },
  };
}

function cloneFormValue(values: ConfigFormValue): ConfigFormValue {
  return {
    agents: values.agents.map((agent) => ({ ...agent })),
    agent_pool: { ...values.agent_pool },
    agent_runtime: { ...values.agent_runtime },
  };
}

function toPayload(values: ConfigFormValue): UpdateInstanceConfigRequest {
  const agents: NonNullable<UpdateInstanceConfigRequest["agents"]> = {};
  values.agents.forEach(({ rowId: _, ...agent }) => {
    const code = agent.code.trim();
    if (!code) return;
    agents[code] = {
      name: agent.name.trim(),
      description: agent.description.trim(),
      base_url: agent.base_url.trim(),
      api_key: agent.api_key.trim(),
      model: agent.model.trim(),
      context_window: agent.context_window,
    };
  });
  return {
    agents,
    agent_pool: values.agent_pool,
    agent_runtime: values.agent_runtime,
  };
}

export function SystemConfigPage() {
  const [values, setValues] = useState<ConfigFormValue | null>(null);
  const [savedValues, setSavedValues] = useState<ConfigFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getInstanceConfig();
      if (response.data) {
        const nextValues = toFormValue(response.data);
        setValues(nextValues);
        setSavedValues(cloneFormValue(nextValues));
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const metrics = useMemo(() => {
    const agentCount = values?.agents.length ?? 0;
    return [
      { label: "Agents", value: agentCount },
      { label: "Pool Size", value: values?.agent_pool.max_size ?? "-" },
      { label: "Main Turns", value: values?.agent_runtime.main_max_turns ?? "-" },
      { label: "Compression", value: values?.agent_runtime.context_compression_enabled ? "Enabled" : "Disabled" },
    ];
  }, [values]);

  const updatePool = (patch: Partial<AgentPoolConfig>) => {
    setValues((current) => current && { ...current, agent_pool: { ...current.agent_pool, ...patch } });
  };

  const updateRuntime = (patch: Partial<AgentRuntimeConfig>) => {
    setValues((current) => current && { ...current, agent_runtime: { ...current.agent_runtime, ...patch } });
  };

  const updateAgent = (rowId: string, patch: Partial<AgentConfig>) => {
    setValues((current) => current && {
      ...current,
      agents: current.agents.map((agent) => (agent.rowId === rowId ? { ...agent, ...patch } : agent)),
    });
  };

  const handleCancel = useCallback(() => {
    if (savedValues) setValues(cloneFormValue(savedValues));
  }, [savedValues]);

  const handleSave = useCallback(async () => {
    if (!values || saving) return;

    setSaving(true);
    try {
      const response = await updateInstanceConfig(toPayload(values));
      showApiSuccess(response);
      if (response.data?.config) {
        const nextValues = toFormValue(response.data.config);
        setValues(nextValues);
        setSavedValues(cloneFormValue(nextValues));
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  }, [saving, values]);

  const headerActions = useMemo(() => (
    <>
      <Button icon={<X size={16} />} disabled={!savedValues || saving || loading} onClick={handleCancel}>
        Cancel
      </Button>
      <Button icon={<Save size={16} />} theme="solid" type="primary" loading={saving} disabled={!values} onClick={handleSave}>
        Save
      </Button>
    </>
  ), [handleCancel, loading, savedValues, saving, values]);

  useAdminResourceHeader({
    refreshLabel: "Refresh config",
    loading,
    onRefresh: loadConfig,
    extraActions: headerActions,
    appendExtraActions: true,
  });

  return (
    <section className="system-config-page">
      <div className="metric-strip">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <Spin spinning={loading} wrapperClassName="system-config-spin">
        {values ? (
          <div className="system-config-layout">
            <div className="config-panel">
              <ConfigPanelHeader icon={<Settings size={18} />} title="Runtime" />
              <div className="config-grid">
                <NumberField label="Main Max Turns" value={values.agent_runtime.main_max_turns} min={1}
                  onChange={(main_max_turns) => updateRuntime({ main_max_turns })}
                />
                <NumberField label="Subordinate Max Turns" value={values.agent_runtime.subordinate_max_turns} min={1}
                  onChange={(subordinate_max_turns) => updateRuntime({ subordinate_max_turns })}
                />
                <NumberField label="Stream Idle Timeout" value={values.agent_runtime.model_stream_idle_timeout_seconds} min={30}
                  onChange={(model_stream_idle_timeout_seconds) => updateRuntime({ model_stream_idle_timeout_seconds })}
                />
                <ToggleField label="Context Compression" checked={values.agent_runtime.context_compression_enabled}
                  onChange={(context_compression_enabled) => updateRuntime({ context_compression_enabled })}
                />
                <NumberField label="Trigger Ratio" value={values.agent_runtime.context_compression_trigger_ratio} min={0.01} max={0.99} step={0.01}
                  onChange={(context_compression_trigger_ratio) => updateRuntime({ context_compression_trigger_ratio })}
                />
                <NumberField label="Hard Stop Ratio" value={values.agent_runtime.context_compression_hard_stop_ratio} min={0.01} max={0.99} step={0.01}
                  onChange={(context_compression_hard_stop_ratio) => updateRuntime({ context_compression_hard_stop_ratio })}
                />
                <NumberField label="Target Ratio" value={values.agent_runtime.context_compression_target_ratio} min={0.01} max={0.99} step={0.01}
                  onChange={(context_compression_target_ratio) => updateRuntime({ context_compression_target_ratio })}
                />
                <NumberField label="Preserve Recent Ratio" value={values.agent_runtime.context_compression_preserve_recent_ratio} min={0.01} max={0.99} step={0.01}
                  onChange={(context_compression_preserve_recent_ratio) => updateRuntime({ context_compression_preserve_recent_ratio })}
                />
                <NumberField label="Preserve Recent Items" value={values.agent_runtime.context_compression_preserve_recent_items} min={1}
                  onChange={(context_compression_preserve_recent_items) => updateRuntime({ context_compression_preserve_recent_items })}
                />
                <NumberField label="Minimum Items" value={values.agent_runtime.context_compression_min_items} min={1}
                  onChange={(context_compression_min_items) => updateRuntime({ context_compression_min_items })}
                />
                <NumberField label="Summary Max Tokens" value={values.agent_runtime.context_compression_summary_max_tokens} min={512}
                  onChange={(context_compression_summary_max_tokens) => updateRuntime({ context_compression_summary_max_tokens })}
                />
              </div>
            </div>

            <div className="config-panel">
              <ConfigPanelHeader icon={<RotateCcw size={18} />} title="Agent Pool" />
              <div className="config-grid compact">
                <NumberField label="Max Size" value={values.agent_pool.max_size} min={1}
                  onChange={(max_size) => updatePool({ max_size })}
                />
                <NumberField label="TTL Seconds" value={values.agent_pool.ttl_seconds} min={0}
                  onChange={(ttl_seconds) => updatePool({ ttl_seconds })}
                />
                <NumberField label="Sweep Interval Seconds" value={values.agent_pool.sweep_interval_seconds} min={1}
                  onChange={(sweep_interval_seconds) => updatePool({ sweep_interval_seconds })}
                />
              </div>
            </div>

            <div className="config-panel agents-panel">
              <ConfigPanelHeader icon={<Bot size={18} />} title="Agents" />
              <div className="agent-config-list">
                {values.agents.map((agent) => (
                  <AgentConfigEditor
                    key={agent.rowId}
                    agent={agent}
                    onChange={(patch) => updateAgent(agent.rowId, patch)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Spin>

    </section>
  );
}

function ConfigPanelHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="config-panel-header">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function AgentConfigEditor({
  agent,
  onChange,
}: {
  agent: AgentFormValue;
  onChange: (patch: Partial<AgentConfig>) => void;
}) {
  return (
    <div className="agent-config-card">
      <div className="agent-config-card-header">
        <strong>{agent.name || agent.code || "New Agent"}</strong>
        <span>{agent.code}</span>
      </div>
      <div className="agent-form-grid">
        <TextField label="Name" value={agent.name} maxLength={128} onChange={(name) => onChange({ name })} />
        <TextField label="Base URL" value={agent.base_url} onChange={(base_url) => onChange({ base_url })} />
        <TextField label="Model" value={agent.model} onChange={(model) => onChange({ model })} />
        <TextField label="API Key" value={agent.api_key} password onChange={(api_key) => onChange({ api_key })} />
        <NumberField label="Context Window" value={agent.context_window} min={0}
          onChange={(context_window) => onChange({ context_window })}
        />
        <label className="field full">
          <span>Description</span>
          <TextArea value={agent.description} autosize={{ minRows: 2, maxRows: 4 }} onChange={(description) => onChange({ description })} />
        </label>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  maxLength,
  password = false,
  onChange,
}: {
  label: string;
  value: string;
  maxLength?: number;
  password?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Input type={password ? "password" : "text"} value={value} maxLength={maxLength} onChange={onChange} />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <InputNumber value={value} min={min} max={max} step={step} onChange={(next) => typeof next === "number" && onChange(next)} />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="field switch-field">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}
