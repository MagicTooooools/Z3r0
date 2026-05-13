import { SYSTEM_USER_ROLES, WORK_PROJECT_TYPES } from "./generated/constants";
import type { SystemUserRole, WorkProjectType } from "./types";

const SYSTEM_USER_ROLE_SET = new Set<string>(SYSTEM_USER_ROLES);

const WORK_PROJECT_TYPE_SET = new Set<string>(WORK_PROJECT_TYPES);

export function getSystemUserRoles(): SystemUserRole[] {
  return [...SYSTEM_USER_ROLES];
}

export function isSystemUserRole(value: unknown): value is SystemUserRole {
  return typeof value === "string" && SYSTEM_USER_ROLE_SET.has(value);
}

export function getWorkProjectTypes(): WorkProjectType[] {
  return [...WORK_PROJECT_TYPES];
}

export function isWorkProjectType(value: unknown): value is WorkProjectType {
  return typeof value === "string" && WORK_PROJECT_TYPE_SET.has(value);
}
