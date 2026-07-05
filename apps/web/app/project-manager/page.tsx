"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";

type DailyReportRow = {
  dailyFactId: string;
  locationCode: string;
  locationName: string;
  projectCode: string;
  projectName: string;
  factStatus: string;
  actualStatus: string;
  quantityVariance: number;
  manDayVariance: number;
  productivityRatio: number;
};

type DailyReportResponse = {
  rows: DailyReportRow[];
  summary: {
    totalPlannedQuantity: number;
    totalFactQuantity: number;
    totalPlannedManDay: number;
    totalFactManDay: number;
    totalOvertime: number;
    quantityCompletionRate: number;
    productivityRatio: number;
    rowCount: number;
  };
};

type DailyFact = {
  id: string;
  status: string;
  dailyPlanId: string;
  actualStatus: string;
};

function abs(value: number) {
  return Math.abs(value);
}

export default function ProjectManagerPage() {
  const [locale] = useLocale();
  const [report, setReport] = useState<DailyReportResponse | null>(null);
  const [facts, setFacts] = useState<DailyFact[]>([]);
  const [error, setError] = useState("");

  const strings = locale === "en"
    ? {
        eyebrow: "Project Manager workspace",
        title: "Keep reporting under control.",
        lead: "Track readiness and variance at a glance.",
        readinessTitle: "Report readiness",
        varianceTitle: "Variance watch",
        approvalsTitle: "Approval closeout",
        approvalsAction: "Approvals",
        reportsAction: "Reports",
        dashboardAction: "Dashboard",
        reportRows: "Report-ready rows",
        completionRate: "Completion rate",
        productivityRatio: "Productivity ratio",
        totalVariance: "Total variance",
        topExceptions: "Top exceptions",
        noRows: "No reporting rows yet.",
        noExceptions: "No variance exceptions at the moment.",
        closedFacts: "Closed facts",
        openFacts: "Open facts",
      }
    : {
        eyebrow: "Project Manager çalışma alanı",
        title: "Raporlamayı kontrol altında tut.",
        lead: "Hazırlığı ve varyansı tek bakışta izle.",
        readinessTitle: "Raporlama hazırlığı",
        varianceTitle: "Varyans takibi",
        approvalsTitle: "Onay kapanışı",
        approvalsAction: "Onaylar",
        reportsAction: "Raporlar",
        dashboardAction: "Pano",
        reportRows: "Rapor satırları",
        completionRate: "Tamamlanma oranı",
        productivityRatio: "Verimlilik oranı",
        totalVariance: "Toplam varyans",
        topExceptions: "Başlıca istisnalar",
        noRows: "Henüz rapor satırı yok.",
        noExceptions: "Şu anda varyans istisnası yok.",
        closedFacts: "Kapanan fişler",
        openFacts: "Açık fişler",
      };
  const common = copy[locale].common;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [reportResponse, factsResponse] = await Promise.all([
          apiFetch<DailyReportResponse>("/reports/daily"),
          apiFetch<{ success: boolean; data: DailyFact[] }>("/daily-facts"),
        ]);
        if (cancelled) return;
        setReport(reportResponse);
        setFacts(factsResponse.data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load project manager workspace");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const exceptions = useMemo(
    () => (report?.rows ?? []).filter((row) => abs(row.quantityVariance) > 0 || abs(row.manDayVariance) > 0).slice(0, 4),
    [report]
  );
  const closedFacts = useMemo(
    () => facts.filter((fact) => fact.status.toUpperCase().includes("APPROVED") || fact.status.toUpperCase() === "REJECTED").length,
    [facts]
  );
  const openFacts = useMemo(
    () => facts.filter((fact) => fact.status.toUpperCase() === "SUBMITTED" || fact.status.toUpperCase() === "DRAFT").length,
    [facts]
  );

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{strings.reportRows}: {report?.summary.rowCount ?? 0}</span>
            <span className="pill warn">{common.roleLane}: PROJECT_MANAGER</span>
            <span className="pill">{common.workspaceStandard}</span>
          </>
        }
        actions={
          <>
            <Link className="button secondary" href="/reports/daily">
              {strings.reportsAction}
            </Link>
            <Link className="button ghost" href="/dashboard">
              {strings.dashboardAction}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{strings.reportRows}</span>
          <strong className="stat-value">{report?.summary.rowCount ?? 0}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.completionRate}</span>
          <strong className="stat-value">{(report?.summary.quantityCompletionRate ?? 0).toFixed(1)}%</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.productivityRatio}</span>
          <strong className="stat-value">{(report?.summary.productivityRatio ?? 0).toFixed(2)}</strong>
        </article>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.readinessTitle}</p>
            </div>
            <span className="pill">{strings.closedFacts}: {closedFacts}</span>
          </div>

          <div className="grid cols-3" style={{ marginTop: 12 }}>
            <article className="stat">
              <span className="muted">{locale === "en" ? "Planned quantity" : "Planlanan miktar"}</span>
              <strong className="stat-value">{report?.summary.totalPlannedQuantity ?? 0}</strong>
            </article>
            <article className="stat">
              <span className="muted">{locale === "en" ? "Fact quantity" : "Fiş miktarı"}</span>
              <strong className="stat-value">{report?.summary.totalFactQuantity ?? 0}</strong>
            </article>
            <article className="stat">
              <span className="muted">{locale === "en" ? "Overtime" : "Fazla mesai"}</span>
              <strong className="stat-value">{report?.summary.totalOvertime ?? 0}</strong>
            </article>
          </div>
        </div>

        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.varianceTitle}</p>
            </div>
            <span className="pill">{strings.totalVariance}</span>
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            {exceptions.map((row) => (
              <div key={row.dailyFactId} className="notice">
                <strong>{row.locationCode} - {row.projectCode}</strong>
                <div className="muted">
                  {row.actualStatus} · {row.quantityVariance} qty · {row.manDayVariance} md · {row.productivityRatio.toFixed(2)}
                </div>
              </div>
            ))}
            {exceptions.length === 0 ? <div className="notice">{strings.noExceptions}</div> : null}
          </div>
        </div>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
          <div className="card pad">
            <p className="section-title">{strings.approvalsTitle}</p>
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <article className="stat">
              <span className="muted">{strings.closedFacts}</span>
              <strong className="stat-value">{closedFacts}</strong>
            </article>
            <article className="stat">
              <span className="muted">{strings.openFacts}</span>
              <strong className="stat-value">{openFacts}</strong>
            </article>
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{strings.topExceptions}</p>
          <div className="stack" style={{ marginTop: 12 }}>
            {facts
              .filter((fact) => fact.status.toUpperCase().includes("RETURNED") || fact.status.toUpperCase().includes("REJECTED"))
              .slice(0, 3)
              .map((fact) => (
                <div key={fact.id} className="notice danger">
                  <strong>{fact.status}</strong>
                  <div className="muted">{fact.dailyPlanId} · {fact.actualStatus}</div>
                </div>
              ))}
            {facts.filter((fact) => fact.status.toUpperCase().includes("RETURNED") || fact.status.toUpperCase().includes("REJECTED")).length === 0 ? (
              <div className="notice">{strings.noRows}</div>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <section className="notice danger" style={{ marginTop: 18 }}>{error}</section> : null}
    </main>
  );
}
