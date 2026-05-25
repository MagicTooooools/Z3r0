import { Modal, Progress, Spin, Tag } from "@douyinfe/semi-ui";
import { ClipboardList, FolderKanban, UserRound } from "lucide-react";
import type { WorkProject } from "../../shared/api/types";
import {
  WORK_PROJECT_STATUS_COLOR,
  WORK_PROJECT_STATUS_LABEL,
  WORK_PROJECT_TASK_STATUS_COLOR,
  WORK_PROJECT_TASK_STATUS_LABEL,
  WORK_PROJECT_TYPE_COLOR,
  WORK_PROJECT_TYPE_LABEL,
} from "../../shared/lib/labels";

type WorkProjectInfoModalProps = {
  open: boolean;
  loading: boolean;
  project: WorkProject | null;
  onClose: () => void;
};

function assetLines(project: WorkProject): string[] {
  return project.assets_text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function ownerNames(project: WorkProject): string {
  return project.owners.map((owner) => owner.username).join(", ") || "No owners";
}

export function WorkProjectInfoModal({ open, loading, project, onClose }: WorkProjectInfoModalProps) {
  const assets = project ? assetLines(project) : [];

  return (
    <Modal
      visible={open}
      title={<ProjectInfoTitle project={project} />}
      width="min(960px, calc(100vw - 32px))"
      footer={null}
      onCancel={onClose}
    >
      <Spin spinning={loading}>
        {project ? (
          <div className="project-info-content">
            <section className="project-info-meta">
              <div>
                <span>Type</span>
                <Tag color={WORK_PROJECT_TYPE_COLOR[project.type]}>{WORK_PROJECT_TYPE_LABEL[project.type]}</Tag>
              </div>
              <div>
                <span>Status</span>
                <Tag color={WORK_PROJECT_STATUS_COLOR[project.status]}>{WORK_PROJECT_STATUS_LABEL[project.status]}</Tag>
              </div>
              <div>
                <span>Owners</span>
                <strong>{ownerNames(project)}</strong>
              </div>
              <div>
                <span>Sandbox</span>
                <strong>{project.sandbox_container_id ?? "-"}</strong>
              </div>
            </section>

            <section className="project-info-progress">
              <span>Task Progress</span>
              <Progress percent={project.progress} size="small" showInfo />
            </section>

            <section className="project-info-grid">
              <ProjectInfoPanel title="Target Assets" icon={<FolderKanban size={15} />} empty={!assets.length}>
                <div className="project-info-scroll-list project-info-assets">
                  {assets.map((asset, index) => <div key={`${index}:${asset}`}>{asset}</div>)}
                </div>
              </ProjectInfoPanel>

              <ProjectInfoPanel title="Tasks" icon={<ClipboardList size={15} />} empty={!project.tasks.length}>
                <div className="project-info-scroll-list project-info-tasks">
                  {project.tasks.map((task) => (
                    <div key={task.id ?? task.title} className="project-info-task-row">
                      <span>{task.title}</span>
                      <Tag color={WORK_PROJECT_TASK_STATUS_COLOR[task.status]}>{WORK_PROJECT_TASK_STATUS_LABEL[task.status]}</Tag>
                      <Progress percent={task.progress} size="small" showInfo={false} />
                    </div>
                  ))}
                </div>
              </ProjectInfoPanel>
            </section>

            <ProjectInfoPanel title="Agent Summaries" icon={<UserRound size={15} />} empty={!project.agent_summaries.length}>
              <div className="project-info-scroll-list project-info-summaries">
                {project.agent_summaries.map((summary) => (
                  <article key={summary.agent_code} className="project-info-summary">
                    <header>
                      <strong>{summary.agent_code}</strong>
                      {summary.updated_at ? <span>{new Date(summary.updated_at).toLocaleString()}</span> : null}
                    </header>
                    {summary.summary?.task_id || summary.summary?.task_title ? (
                      <div className="project-info-summary-task">
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
            </ProjectInfoPanel>
          </div>
        ) : null}
      </Spin>
    </Modal>
  );
}

function ProjectInfoTitle({ project }: { project: WorkProject | null }) {
  return (
    <div className="project-info-title">
      <strong>{project?.name ?? "Work Project"}</strong>
      {project?.description ? <span>{project.description}</span> : null}
    </div>
  );
}

function ProjectInfoPanel({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="project-info-panel">
      <header>
        {icon}
        <strong>{title}</strong>
      </header>
      {empty ? <div className="project-info-empty">No data.</div> : children}
    </section>
  );
}

function SummaryBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="project-info-summary-block">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function SummaryList({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="project-info-summary-block">
      <span>{label}</span>
      <ul>
        {values.map((value, index) => <li key={`${index}:${value}`}>{value}</li>)}
      </ul>
    </div>
  );
}
