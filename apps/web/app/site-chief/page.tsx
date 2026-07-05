"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";

type DailyFact = {
  id: string;
  dailyPlanId: string;
  status: string;
  actualStatus: string;
  factQuantity: number;
  factManDay: number;
  overtime: number;
  submittedByUserId: string;
  version: number;
};

type DailyPlan = {
  id: string;
  locationId: string;
  projectId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
};

type DailyReportResponse = {
  rows: Array<{
    dailyPlanId: string;
    dailyFactId: string;
    locationCode: string;
    locationName: string;
    projectCode: string;
    projectName: string;
    unit: string;
    factStatus: string;
    actualStatus: string;
    quantityVariance: number;
    manDayVariance: number;
  }>;
  summary: {
    rowCount: number;
    quantityCompletionRate: number;
    productivityRatio: number;
  };
};

function statusBucket(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "SUBMITTED" || normalized === "DRAFT") return "open";
  if (normalized === "RETURNED_FOR_REVISION" || normalized === "REJECTED") return "exception";
  return "closed";
}

export default function SiteChiefPage() {
  const [locale] = useLocale();
  const [facts, setFacts] = useState<DailyFact[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [report, setReport] = useState<DailyReportResponse | null>(null);
  const [error, setError] = useState("");

  const strings = locale === "en"
    ? {
        eyebrow: "Site Chief workspace",
        title: "Keep the approval queue moving.",
        lead: "Watch the queue and reporting readiness.",
        queueTitle: "Approval queue",
        readinessTitle: "Reporting readiness",
        exceptionsTitle: "Exceptions",
        approvalsAction: "Approvals",
        reportsAction: "Reports",
        dashboardAction: "Dashboard",
        openFacts: "Queue",
        queueSummary: "Queue summary",
        openNow: "Open now",
        inReview: "In review",
        resolved: "Resolved",
        sourcePlan: "Source plan",
        noFacts: "No facts in the queue yet.",
        noExceptions: "No exceptions at the moment.",
        reportRows: "Approved rows",
        completionRate: "Completion rate",
        productivityRatio: "Productivity ratio",
      }
    : {
        eyebrow: "Site Chief çalışma alanı",
        title: "Onay kuyruğunu ilerlet.",
        lead: "Kuyruğu ve raporlama hazırlığını izle.",
        queueTitle: "Onay kuyruğu",
        readinessTitle: "Raporlama hazırlığı",
        exceptionsTitle: "İstisnalar",
        approvalsAction: "Onaylar",
        reportsAction: "Raporlar",
        dashboardAction: "Pano",
        openFacts: "Kuyruk",
        queueSummary: "Kuyruk özeti",
        openNow: "Açık",
        inReview: "İncelemede",
        resolved: "Sonuçlanan",
        sourcePlan: "Kaynak plan",
        noFacts: "Henüz kuyrukta fiş yok.",
        noExceptions: "Şu an istisna yok.",
        reportRows: "Onaylı satırlar",
        completionRate: "Tamamlanma oranı",
        productivityRatio: "Verimlilik oranı",
      };
  const common = copy[locale].common;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [factsResponse, plansResponse, reportResponse] = await Promise.all([
          apiFetch<{ success: boolean; data: DailyFact[] }>("/daily-facts"),
          apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans"),
          apiFetch<DailyReportResponse>("/reports/daily"),
        ]);
        if (cancelled) return;
        setFacts(factsResponse.data);
        setPlans(plansResponse.data);
        setReport(reportResponse);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load site chief workspace");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const queueCounts = useMemo(() => {
    return facts.reduce(
      (acc, fact) => {
        acc.total += 1;
        const bucket = statusBucket(fact.status);
        if (bucket === "open") acc.open += 1;
        if (bucket === "exception") acc.exception += 1;
        if (bucket === "closed") acc.closed += 1;
        return acc;
      },
      { total: 0, open: 0, exception: 0, closed: 0 }
    );
  }, [facts]);

  const attentionRows = useMemo(
    () => facts.filter((fact) => statusBucket(fact.status) !== "closed").slice(0, 4),
    [facts]
  );
  const reportRows = report?.rows.slice(0, 3) ?? [];

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{strings.queueSummary}: {queueCounts.total}</span>
            <span className="pill warn">{common.roleLane}: SITE_CHIEF</span>
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
          <span className="muted">{strings.queueSummary}</span>
          <strong className="stat-value">{queueCounts.total}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.inReview}</span>
          <strong className="stat-value">{queueCounts.open}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.resolved}</span>
          <strong className="stat-value">{queueCounts.closed}</strong>
        </article>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.queueTitle}</p>
            </div>
            <span className="pill">{strings.openNow}</span>
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            {attentionRows.map((fact) => {
              const plan = plans.find((item) => item.id === fact.dailyPlanId);
              return (
                <div key={fact.id} className="notice">
                  <strong>{fact.id}</strong>
                  <div className="muted">
                    {plan?.locationId ?? common.none} · {plan?.projectId ?? common.none} · {fact.status}
                  </div>
                  <div className="muted">
                    {fact.factQuantity} / {fact.factManDay} · {fact.overtime} OT
                  </div>
                </div>
              );
            })}
            {attentionRows.length === 0 ? <div className="notice">{strings.noFacts}</div> : null}
          </div>
        </div>

        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.readinessTitle}</p>
            </div>
            <span className="pill">
              {report?.summary.rowCount ?? 0} {strings.reportRows}
            </span>
          </div>

          <div className="grid cols-3" style={{ marginTop: 12 }}>
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
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            {reportRows.map((row) => (
              <div key={row.dailyFactId} className="notice">
                <strong>{row.locationCode} - {row.projectCode}</strong>
                <div className="muted">
                  {row.actualStatus} · {row.quantityVariance} qty · {row.manDayVariance} md
                </div>
              </div>
            ))}
            {reportRows.length === 0 ? <div className="notice">{strings.noFacts}</div> : null}
          </div>
        </div>
      </section>

      <section className="card pad" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <p className="section-title">{strings.exceptionsTitle}</p>
          </div>
          <Link className="button secondary" href="/approvals">
            {strings.openFacts}
          </Link>
        </div>

        <div className="grid cols-3" style={{ marginTop: 12 }}>
          {facts
            .filter((fact) => statusBucket(fact.status) === "exception")
            .slice(0, 3)
            .map((fact) => {
              const plan = plans.find((item) => item.id === fact.dailyPlanId);
              return (
                <div key={fact.id} className="notice danger">
                  <strong>{fact.status}</strong>
                  <div className="muted">
                    {plan?.locationId ?? common.none} · {plan?.projectId ?? common.none}
                  </div>
                </div>
              );
            })}
          {facts.filter((fact) => statusBucket(fact.status) === "exception").length === 0 ? (
            <div className="notice">{strings.noExceptions}</div>
          ) : null}
        </div>
      </section>

      {error ? <section className="notice danger" style={{ marginTop: 18 }}>{error}</section> : null}
    </main>
  );
}
