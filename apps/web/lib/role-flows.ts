import type { Locale } from "./i18n";

export type AppRole = "TECH_OFFICE" | "HEAD_OF_MASTER" | "SITE_CHIEF" | "PROJECT_MANAGER" | "ADMIN";

export function getLoginLandingPath(role?: string) {
  switch (role) {
    case "TECH_OFFICE":
      return "/daily-plans";
    case "HEAD_OF_MASTER":
      return "/head-of-master";
    case "SITE_CHIEF":
      return "/site-chief";
    case "PROJECT_MANAGER":
      return "/project-manager";
    case "ADMIN":
      return "/admin/users";
    default:
      return "/dashboard";
  }
}

export function getDashboardPrimaryAction(role?: string) {
  switch (role) {
    case "HEAD_OF_MASTER":
      return { href: "/head-of-master", label: "Execution" };
    case "TECH_OFFICE":
      return { href: "/daily-plans", label: "Planning" };
    case "SITE_CHIEF":
      return { href: "/reports/daily", label: "Reports" };
    case "PROJECT_MANAGER":
      return { href: "/reports/daily", label: "Reports" };
    case "ADMIN":
      return { href: "/admin/users", label: "Manage users" };
    default:
      return { href: "/daily-plans", label: "Planning" };
  }
}

export function getDashboardRoleText(locale: Locale, role?: string) {
  if (locale === "en") {
    switch (role) {
      case "HEAD_OF_MASTER":
        return "Execution";
      case "TECH_OFFICE":
        return "Planning";
      case "SITE_CHIEF":
        return "Site review";
      case "PROJECT_MANAGER":
        return "Project review";
      case "ADMIN":
        return "Admin";
      default:
        return "Planning";
    }
  }

  switch (role) {
    case "HEAD_OF_MASTER":
      return "Saha yürütme";
    case "TECH_OFFICE":
      return "Planlama";
    case "SITE_CHIEF":
      return "Şantiye inceleme";
    case "PROJECT_MANAGER":
      return "Proje inceleme";
    case "ADMIN":
      return "Yönetici";
    default:
      return "Planlama";
  }
}

export function getApprovalCapabilities(role?: string) {
  return {
    canApproveHeadMaster: role === "HEAD_OF_MASTER" || role === "ADMIN",
    canApproveSiteChief: role === "SITE_CHIEF" || role === "ADMIN",
    canApproveProjectManager: role === "PROJECT_MANAGER" || role === "ADMIN",
    canOpenAdminReview: role === "ADMIN",
  };
}
