"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch, getStoredUser, type StoredUser } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";
import { getDashboardPrimaryAction, getDashboardRoleText } from "../../lib/role-flows";

type MeResponse = {
  success: boolean;
  data: StoredUser | null;
};

type MasterDataResponse = {
  success: boolean;
  data: {
    source: string;
    importedAt: string;
    locations: Array<{ id: string; code: string; name: string }>;
    projects: Array<{ id: string; code: string; name: string }>;
    typeOfWorks: Array<{ id: string; code: string; name: string }>;
    subTypeOfWorks: Array<{ id: string; code: string; name: string }>;
    subSubTypeOfWorks: Array<{ id: string; code: string; name: string }>;
    workerTypes: Array<{ id: string; name: string }>;
    zzzDetails: Array<{ id: string; code: string; name: string }>;
  };
};

type HealthSummaryResponse = {
  success: boolean;
  data: {
    status: "ok" | "degraded";
    database: string;
    recentAudits: number;
    failedLogins: number;
    accessDenied: number;
    lastAuditAt: string | null;
    lastAuditAction: string | null;
    checkedAt: string;
  };
};

const metricLabels = {
  locations: "Locations loaded",
  projects: "Projects loaded",
  typeOfWorks: "Type of works",
  subTypeOfWorks: "Sub type works",
  subSubTypeOfWorks: "Sub-sub types",
  workerTypes: "Worker types",
} as const;

const metricOrder = [
  "locations",
  "projects",
  "typeOfWorks",
  "subTypeOfWorks",
  "subSubTypeOfWorks",
  "workerTypes",
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [locale] = useLocale();
  const [me, setMe] = useState<StoredUser | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [snapshot, setSnapshot] = useState<{ source: string; importedAt: string } | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummaryResponse["data"] | null>(null);
  const [error, setError] = useState("");
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const strings = copy[locale].dashboard;
  const common = copy[locale].common;
  const importedAtLabel = snapshot?.importedAt
    ? new Date(snapshot.importedAt).toLocaleString(locale === "en" ? "en-US" : "tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : locale === "en"
      ? "loading..."
      : "yükleniyor...";

  useEffect(() => {
    setStoredUser(getStoredUser());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const meResponse = await apiFetch<MeResponse>("/auth/me");
        const snapshot = await apiFetch<MasterDataResponse>("/master-data");
        const summary = await apiFetch<HealthSummaryResponse>("/health/summary");
        setMe(meResponse.data ?? storedUser);
        setSnapshot({
          source: snapshot.data.source,
          importedAt: snapshot.data.importedAt,
        });
        setHealthSummary(summary.data);
        setCounts({
          locations: snapshot.data.locations.length,
          projects: snapshot.data.projects.length,
          typeOfWorks: snapshot.data.typeOfWorks.length,
          subTypeOfWorks: snapshot.data.subTypeOfWorks.length,
          subSubTypeOfWorks: snapshot.data.subSubTypeOfWorks.length,
          workerTypes: snapshot.data.workerTypes.length,
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    }

    load();
  }, []);

  const roleText = getDashboardRoleText(locale, me?.role);
  const action = getDashboardPrimaryAction(me?.role);
  const primaryAction =
    action.href === "/head-of-master"
      ? { ...action, label: strings.openExecution }
      : action.href === "/daily-plans"
        ? { ...action, label: strings.openPlanning }
        : action.href === "/reports/daily"
          ? { ...action, label: strings.openReports }
          : action.href === "/admin/users"
            ? { ...action, label: strings.manageUsers }
            : action;

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{me?.fullName ?? me?.email ?? storedUser?.fullName ?? common.loadingUser}</span>
            <span className="pill warn">{common.roleLane}: {roleText}</span>
            <span className="pill">{common.desktopWorkspace}</span>
          </>
        }
        actions={
          <>
            <Link className="button primary" href={primaryAction.href}>
              {primaryAction.label}
            </Link>
            <Link className="button ghost" href="/login">
              {common.switchAccount}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        {metricOrder.map((key) => (
          <article key={key} className="stat">
            <span className="muted">{metricLabels[key as keyof typeof metricLabels]}</span>
            <strong className="stat-value">{counts[key] ?? 0}</strong>
          </article>
        ))}
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <p className="section-title">{strings.nextTitle}</p>
          <div className="notice" style={{ marginTop: 12 }}>
            {primaryAction.label}. {strings.nextTechnicalOffice}
            {roleText === "Execution" ? ` ${strings.nextHeadOfMaster}` : ""}
            {roleText === "Site review" || roleText === "Project review" ? ` ${strings.nextApprover}` : ""}
          </div>
          <div className="hero-actions" style={{ marginTop: 14 }}>
            <Link className="button primary" href={primaryAction.href}>
              {primaryAction.label}
            </Link>
            <Link className="button secondary" href="/login">
              {common.switchAccount}
            </Link>
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{strings.masterStatusTitle}</p>
          <div className="notice" style={{ marginTop: 12 }}>
            {locale === "en"
              ? `Source ${snapshot?.source ?? "loading..."} · Imported ${importedAtLabel}`
              : `Kaynak ${snapshot?.source ?? "yükleniyor..."} · İçe aktarma ${importedAtLabel}`}
          </div>
        </div>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <p className="section-title">{locale === "en" ? "System health" : "Sistem sağlığı"}</p>
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>{locale === "en" ? "Status" : "Durum"}:</strong> {healthSummary?.status ?? (locale === "en" ? "loading" : "yükleniyor")}
            <br />
            <strong>{locale === "en" ? "Database" : "Veritabanı"}:</strong> {healthSummary?.database ?? "-"}
            <br />
            <strong>{locale === "en" ? "Recent audits" : "Son auditler"}:</strong> {healthSummary?.recentAudits ?? 0}
            <br />
            <strong>{locale === "en" ? "Failed logins" : "Başarısız girişler"}:</strong> {healthSummary?.failedLogins ?? 0}
            <br />
            <strong>{locale === "en" ? "Access denied" : "Erişim reddi"}:</strong> {healthSummary?.accessDenied ?? 0}
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{locale === "en" ? "Last audit" : "Son audit"}</p>
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>{locale === "en" ? "Action" : "Aksiyon"}:</strong> {healthSummary?.lastAuditAction ?? "-"}
            <br />
            <strong>{locale === "en" ? "Checked at" : "Kontrol zamanı"}:</strong>{" "}
            {healthSummary?.checkedAt
              ? new Date(healthSummary.checkedAt).toLocaleString(locale === "en" ? "en-US" : "tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "-"}
            <br />
            <strong>{locale === "en" ? "Last audit time" : "Son audit zamanı"}:</strong>{" "}
            {healthSummary?.lastAuditAt
              ? new Date(healthSummary.lastAuditAt).toLocaleString(locale === "en" ? "en-US" : "tr-TR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "-"}
          </div>
        </div>
      </section>

      {error ? (
        <section className="notice danger" style={{ marginTop: 18 }}>
          {error}
        </section>
      ) : null}
    </main>
  );
}
