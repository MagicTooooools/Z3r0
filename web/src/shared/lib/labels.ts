import type {
  SandboxContainerStatus,
  SandboxImageStatus,
  SystemUserRole,
  WorkProjectStatus,
  WorkProjectTaskStatus,
  WorkProjectType,
} from "../api/types";

export const SYSTEM_USER_ROLE_LABEL: Record<SystemUserRole, string> = {
  admin: "Admin",
  user: "User",
};

export const WORK_PROJECT_TYPE_LABEL: Record<WorkProjectType, string> = {
  penetration_test: "Penetration Test",
  source_code_audit: "Source Code Audit",
};

export const WORK_PROJECT_STATUS_LABEL: Record<WorkProjectStatus, string> = {
  working: "Working",
  completed: "Completed",
  canceled: "Canceled",
};

export const WORK_PROJECT_TASK_STATUS_LABEL: Record<WorkProjectTaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export const SANDBOX_IMAGE_STATUS_LABEL: Record<SandboxImageStatus, string> = {
  pulling: "Pulling",
  ready: "Ready",
  failed: "Failed",
  canceled: "Canceled",
};

export const SANDBOX_CONTAINER_STATUS_LABEL: Record<SandboxContainerStatus, string> = {
  created: "Created",
  running: "Running",
  stopped: "Stopped",
  error: "Error",
};

export type SemiTagColor = "amber" | "green" | "red" | "grey" | "blue" | "cyan";

export const WORK_PROJECT_STATUS_COLOR: Record<WorkProjectStatus, SemiTagColor> = {
  working: "amber",
  completed: "green",
  canceled: "grey",
};

export const WORK_PROJECT_TYPE_COLOR: Record<WorkProjectType, SemiTagColor> = {
  penetration_test: "blue",
  source_code_audit: "cyan",
};

export const WORK_PROJECT_TASK_STATUS_COLOR: Record<WorkProjectTaskStatus, SemiTagColor> = {
  todo: "grey",
  in_progress: "blue",
  blocked: "amber",
  done: "green",
};

export const SANDBOX_IMAGE_STATUS_COLOR: Record<SandboxImageStatus, SemiTagColor> = {
  pulling: "amber",
  ready: "green",
  failed: "red",
  canceled: "grey",
};

export const SANDBOX_CONTAINER_STATUS_COLOR: Record<SandboxContainerStatus, SemiTagColor> = {
  created: "blue",
  running: "green",
  stopped: "grey",
  error: "red",
};
