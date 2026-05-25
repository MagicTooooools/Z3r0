import { Button, Popconfirm, Progress, Tag } from "@douyinfe/semi-ui";
import {
  Ban,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  FolderKanban,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminHeaderActions, useRefreshWorkProjects } from "../../app/layouts/AdminLayout";
import {
  cancelWorkProject,
  createWorkProject,
  deleteWorkProject,
  queryWorkProjects,
  retryWorkProject,
  updateWorkProjectMetadata,
} from "../../shared/api/workProjects";
import { showApiError, showApiSuccess } from "../../shared/api/feedback";
import type {
  CreateWorkProjectRequest,
  WorkProject,
} from "../../shared/api/types";
import { ResourcePageShell } from "../../shared/components/ResourcePageShell";
import { ResourceTable, type ResourceColumn } from "../../shared/components/ResourceTable";
import { usePagedResourceList } from "../../shared/hooks/usePagedResourceList";
import { formatDateTime } from "../../shared/lib/date";
import {
  WORK_PROJECT_STATUS_COLOR,
  WORK_PROJECT_STATUS_LABEL,
  WORK_PROJECT_TASK_STATUS_COLOR,
  WORK_PROJECT_TASK_STATUS_LABEL,
  WORK_PROJECT_TYPE_COLOR,
  WORK_PROJECT_TYPE_LABEL,
} from "../../shared/lib/labels";
import { WorkProjectFormModal } from "./WorkProjectFormModal";

const DEFAULT_PAGE_SIZE = 10;
type AdminAction = "cancel" | "retry" | "delete";

function assetLines(project: WorkProject): string[] {
  return project.assets_text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function ownerNames(project: WorkProject): string {
  return project.owners.map((owner) => owner.username).join(", ") || "No owners";
}

export function WorkProjectsPage() {
  const {
    items: projects, page, keyword, loading, loadItems: loadProjects,
    setKeyword, search, previous, next, canGoBack, canGoNext,
  } = usePagedResourceList<WorkProject>({ pageSize: DEFAULT_PAGE_SIZE, query: queryWorkProjects });
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const setHeaderActions = useAdminHeaderActions();
  const refreshProjectSidebar = useRefreshWorkProjects();
  const [adminAction, setAdminAction] = useState<{ id: number; type: AdminAction } | null>(null);

  const refreshAll = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    setHeaderActions(
      <>
        <Button icon={<RefreshCw size={16} />} onClick={() => void refreshAll()} loading={loading} aria-label="Refresh work projects" />
        <Button icon={<Plus size={16} />} theme="solid" type="danger" onClick={() => { setEditingProject(null); setModalOpen(true); }}>
          Create Project
        </Button>
      </>,
    );
    return () => setHeaderActions(null);
  }, [loading, refreshAll, setHeaderActions]);

  const summary = useMemo(
    () => projects.reduce(
      (acc, project) => ({
        working: acc.working + (project.status === "working" ? 1 : 0),
        sessions: acc.sessions + project.session_count,
        assets: acc.assets + assetLines(project).length,
      }),
      { working: 0, sessions: 0, assets: 0 },
    ),
    [projects],
  );

  const handleSubmit = async (payload: CreateWorkProjectRequest) => {
    setSaving(true);
    try {
      const response = editingProject
        ? await updateWorkProjectMetadata(editingProject.id, payload)
        : await createWorkProject(payload);
      showApiSuccess(response);
      setModalOpen(false);
      setEditingProject(null);
      await refreshAll();
      refreshProjectSidebar();
    } catch (error) {
      showApiError(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = (project: WorkProject) => setExpandedId((current) => (
    current === project.id ? null : project.id
  ));

  const handleAdminProjectAction = async (
    project: WorkProject,
    type: AdminAction,
  ) => {
    setAdminAction({ id: project.id, type });
    try {
      const response = type === "cancel"
        ? await cancelWorkProject(project.id)
        : type === "retry"
          ? await retryWorkProject(project.id)
          : await deleteWorkProject(project.id);
      showApiSuccess(response);
      if (type === "delete") {
        setExpandedId((current) => (current === project.id ? null : current));
      }
      await loadProjects();
      refreshProjectSidebar();
    } catch (error) {
      showApiError(error);
    } finally {
      setAdminAction(null);
    }
  };

  const columns: ResourceColumn<WorkProject>[] = [
    {
      key: "project", header: "Project", width: "minmax(210px, 0.9fr)",
      render: (project) => (
        <div className="project-identity">
          <Button
            icon={expandedId === project.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            theme="borderless"
            size="small"
            onClick={() => toggleProject(project)}
            aria-label={`${expandedId === project.id ? "Collapse" : "Expand"} ${project.name}`}
          />
          <div className="resource-avatar"><FolderKanban size={18} /></div>
          <div>
            <strong>{project.name}</strong>
            <span>{ownerNames(project)} · {project.session_count} sessions</span>
          </div>
        </div>
      ),
    },
    { key: "type", header: "Type", width: "132px", render: (project) => <Tag color={WORK_PROJECT_TYPE_COLOR[project.type]}>{WORK_PROJECT_TYPE_LABEL[project.type]}</Tag> },
    { key: "status", header: "Status", width: "104px", render: (project) => <Tag color={WORK_PROJECT_STATUS_COLOR[project.status]}>{WORK_PROJECT_STATUS_LABEL[project.status]}</Tag> },
    {
      key: "scope", header: "Scope", width: "minmax(170px, 0.5fr)",
      render: (project) => <div className="resource-description">{assetLines(project).length} assets · {project.tasks.length} tasks</div>,
    },
    { key: "updated", header: "Updated", width: "minmax(150px, 0.4fr)", render: (p) => formatDateTime(p.updated_at) },
    {
      key: "actions", header: "Actions", width: "132px",
      render: (project) => (
        <div className="row-actions">
          <Button
            icon={<Edit3 size={15} />}
            theme="borderless"
            aria-label={`Edit ${project.name}`}
            onClick={() => { setEditingProject(project); setModalOpen(true); }}
          />
          <Button
            icon={<Ban size={15} />}
            theme="borderless"
            disabled={project.status !== "working"}
            loading={adminAction?.id === project.id && adminAction.type === "cancel"}
            aria-label={`Cancel ${project.name}`}
            onClick={() => void handleAdminProjectAction(project, "cancel")}
          />
          <Button
              icon={<RotateCcw size={15} />}
              theme="borderless"
              disabled={project.status !== "canceled"}
              loading={adminAction?.id === project.id && adminAction.type === "retry"}
              aria-label={`Retry ${project.name}`}
            onClick={() => void handleAdminProjectAction(project, "retry")}
          />
          <Popconfirm title="Delete project" content={`Delete ${project.name} and all project sessions?`} okType="danger" onConfirm={() => void handleAdminProjectAction(project, "delete")}>
            <Button
              icon={<Trash2 size={15} />}
              theme="borderless"
              type="danger"
              loading={adminAction?.id === project.id && adminAction.type === "delete"}
              aria-label={`Delete ${project.name}`}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const expandedProject = projects.find((project) => project.id === expandedId) ?? null;

  return (
    <>
      <ResourcePageShell
        searchPlaceholder="Search project name, type, description, or status"
        keyword={keyword}
        loading={loading}
        metrics={[
          { label: "Total loaded", value: projects.length },
          { label: "Working", value: summary.working },
          { label: "Project sessions", value: summary.sessions },
          { label: "Assets", value: summary.assets },
        ]}
        empty={projects.length === 0}
        emptyIcon={<FolderKanban size={42} />}
        emptyTitle="No projects found"
        page={page}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        onKeywordChange={setKeyword}
        onSearch={search}
        onPrevious={previous}
        onNext={next}
      >
        <ResourceTable<WorkProject>
          ariaLabel="Work projects"
          className="work-projects-table"
          columns={columns}
          rows={projects}
          rowKey={(project) => project.id}
        />
        {expandedProject ? (
          <WorkProjectExpanded project={expandedProject} />
        ) : null}
      </ResourcePageShell>

      <WorkProjectFormModal
        open={modalOpen}
        saving={saving}
        project={editingProject}
        onCancel={() => { setModalOpen(false); setEditingProject(null); }}
        onSubmit={handleSubmit}
      />
    </>
  );
}

function WorkProjectExpanded({
  project,
}: {
  project: WorkProject;
}) {
  const assets = assetLines(project);

  return (
    <div className="work-project-expanded">
      <section className="work-project-meta">
        <div>
          <span>Owner</span>
          <strong>{ownerNames(project)}</strong>
        </div>
        <div>
          <span>Sandbox</span>
          <strong>{project.sandbox_container_id ?? "-"}</strong>
        </div>
        <div>
          <span>Task Progress</span>
          <Progress percent={project.progress} size="small" showInfo />
        </div>
      </section>

      <section className="work-project-detail-grid">
        <Panel title="Assets" empty={assets.length === 0 ? "No assets." : ""}>
          <div className="work-project-asset-list">
            {assets.map((asset, index) => (
              <div key={`${index}:${asset}`}>{asset}</div>
            ))}
          </div>
        </Panel>
        <Panel title="Tasks" empty={project.tasks.length === 0 ? "No tasks." : ""}>
          <div className="work-project-task-list">
            {project.tasks.map((task) => (
              <div key={task.id ?? task.title} className="work-project-task-row">
                <ClipboardList size={14} />
                <span>{task.title}</span>
                <Tag color={WORK_PROJECT_TASK_STATUS_COLOR[task.status]}>{WORK_PROJECT_TASK_STATUS_LABEL[task.status]}</Tag>
                <Progress percent={task.progress} size="small" showInfo={false} />
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <Panel title="Agent Summaries" empty={project.agent_summaries.length === 0 ? "No summaries." : ""}>
        <div className="work-project-summary-list">
          {project.agent_summaries.map((summary) => (
            <article key={summary.agent_code} className="work-project-summary-row">
              <header>
                <UserRound size={14} />
                <strong>{summary.agent_code}</strong>
                {summary.updated_at ? <span>{formatDateTime(summary.updated_at)}</span> : null}
              </header>
              {summary.summary?.task_id || summary.summary?.task_title ? (
                <div className="work-project-summary-progress">
                  <span>{summary.summary.task_id || summary.summary.task_title}</span>
                  <Progress percent={summary.summary.progress ?? 0} size="small" showInfo />
                </div>
              ) : null}
              <SummaryBlock label="Status" value={summary.summary?.status} />
              <SummaryList label="Findings" values={summary.summary?.findings ?? []} />
              <SummaryList label="Decisions" values={summary.summary?.decisions ?? []} />
              <SummaryList label="Blockers" values={summary.summary?.blockers ?? []} />
              <SummaryList label="Next Steps" values={summary.summary?.next_steps ?? []} />
              <SummaryList label="Evidence" values={summary.summary?.evidence ?? []} />
              <SummaryBlock label="Notes" value={summary.summary?.notes} />
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="work-project-panel">
      <strong>{title}</strong>
      {empty ? <span className="work-project-panel-empty">{empty}</span> : children}
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="work-project-summary-block">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function SummaryList({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="work-project-summary-block">
      <span>{label}</span>
      <ul>
        {values.map((value, index) => <li key={`${index}:${value}`}>{value}</li>)}
      </ul>
    </div>
  );
}
