export type MobileRole = "TECH_OFFICE" | "HEAD_OF_MASTER" | "SITE_CHIEF" | "PROJECT_MANAGER" | "ADMIN";

export function getMobileRoleCapabilities(role?: string) {
  return {
    isHeadOfMaster: role === "HEAD_OF_MASTER",
    isTechOffice: role === "TECH_OFFICE",
    isSiteChief: role === "SITE_CHIEF",
    isProjectManager: role === "PROJECT_MANAGER",
    isAdmin: role === "ADMIN",
  };
}

export function getMobileWorkspaceVisibility(role?: string) {
  const capabilities = getMobileRoleCapabilities(role);
  return {
    showCrewWorkspace: capabilities.isHeadOfMaster || capabilities.isAdmin,
    showAssignmentWorkspace: capabilities.isHeadOfMaster || capabilities.isAdmin,
    showFactForm: capabilities.isHeadOfMaster || capabilities.isAdmin,
    showRoleHub: !(capabilities.isHeadOfMaster || capabilities.isAdmin),
  };
}

export function getMobileRoleOverviewKey(role?: string) {
  if (role === "HEAD_OF_MASTER") return "headMasterOverview";
  if (role === "TECH_OFFICE") return "techOfficeOverview";
  if (role === "SITE_CHIEF") return "siteChiefOverview";
  if (role === "PROJECT_MANAGER") return "projectManagerOverview";
  return "adminOverview";
}

