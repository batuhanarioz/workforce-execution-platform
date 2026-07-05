"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch, getStoredUser, type StoredUser } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";
import { getApprovalCapabilities } from "../../lib/role-flows";

type DailyFact = {
  id: string;
  dailyPlanId: string;
  status: string;
  actualStatus: string;
  factQuantity: number;
  factManDay: number;
  overtime: number;
  comment?: string;
  submittedByUserId: string;
  version: number;
};

type ApprovalHistory = {
  id: string;
  dailyFactId: string;
  approverUserId: string;
  approverRole: string;
  action: string;
  comment?: string;
  createdAt: string;
};

type DailyPlan = {
  id: string;
  locationId: string;
  projectId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [locale] = useLocale();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [me, setMe] = useState<StoredUser | null>(null);
  const [facts, setFacts] = useState<DailyFact[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [selectedFactId, setSelectedFactId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFact = useMemo(
    () => facts.find((fact) => fact.id === selectedFactId) ?? null,
    [facts, selectedFactId]
  );
  const selectedPlan = useMemo(
    () => (selectedFact ? plans.find((plan) => plan.id === selectedFact.dailyPlanId) ?? null : null),
    [plans, selectedFact]
  );
  const strings = copy[locale].approvals;
  const common = copy[locale].common;
  const approvalCapabilities = getApprovalCapabilities(me?.role ?? currentUser?.role);
  const canReviewQueue =
    approvalCapabilities.canApproveHeadMaster ||
    approvalCapabilities.canApproveSiteChief ||
    approvalCapabilities.canApproveProjectManager ||
    approvalCapabilities.canOpenAdminReview;
  const queueCounts = useMemo(() => {
    return facts.reduce(
      (acc, fact) => {
        acc.total += 1;
        const key = fact.status.toUpperCase();
        if (key === "DRAFT") acc.draft += 1;
        if (key === "SUBMITTED") acc.submitted += 1;
        if (
          key === "APPROVED_BY_HEAD_OF_MASTER" ||
          key === "APPROVED_BY_SITE_CHIEF" ||
          key === "APPROVED_BY_PROJECT_MANAGER"
        ) {
          acc.approved += 1;
        }
        if (key === "RETURNED_FOR_REVISION") acc.returned += 1;
        if (key === "REJECTED") acc.rejected += 1;
        return acc;
      },
      { total: 0, draft: 0, submitted: 0, approved: 0, returned: 0, rejected: 0 }
    );
  }, [facts]);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, factsResponse, plansResponse] = await Promise.all([
          apiFetch<{ success: boolean; data: StoredUser | null }>("/auth/me"),
          apiFetch<{ success: boolean; data: DailyFact[] }>("/daily-facts"),
          apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans"),
        ]);
        setMe(meResponse.data ?? currentUser);
        setFacts(factsResponse.data);
        setPlans(plansResponse.data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load approvals");
      }
    }

    load();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      if (!selectedFactId) {
        setHistory([]);
        return;
      }

      try {
        const response = await apiFetch<{ success: boolean; data: ApprovalHistory[] }>(
          `/daily-facts/${selectedFactId}/approval-history`
        );
        setHistory(response.data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load approval history");
      }
    }

    loadHistory();
  }, [selectedFactId]);

  async function refreshFacts() {
    const response = await apiFetch<{ success: boolean; data: DailyFact[] }>("/daily-facts");
    setFacts(response.data);
  }

  async function act(action: "head-master" | "site-chief" | "project-manager" | "return" | "reject") {
    if (!selectedFactId) {
      setError(common.selectFirstFact);
      return;
    }

    try {
      const path =
        action === "head-master"
          ? `/daily-facts/${selectedFactId}/approve/head-master`
          : action === "site-chief"
            ? `/daily-facts/${selectedFactId}/approve/site-chief`
            : action === "project-manager"
              ? `/daily-facts/${selectedFactId}/approve/project-manager`
              : action === "return"
                ? `/daily-facts/${selectedFactId}/return`
                : `/daily-facts/${selectedFactId}/reject`;

      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      await refreshFacts();
      const refreshedHistory = await apiFetch<{ success: boolean; data: ApprovalHistory[] }>(
        `/daily-facts/${selectedFactId}/approval-history`
      );
      setHistory(refreshedHistory.data);
      setMessage(strings.actionCompleted);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to complete action");
    }
  }

  const currentRole = me?.role ?? currentUser?.role;
  const decisionLabel =
    currentRole === "HEAD_OF_MASTER"
      ? strings.approveHeadMaster
      : currentRole === "SITE_CHIEF"
        ? strings.approveSiteChief
      : currentRole === "PROJECT_MANAGER"
        ? strings.approveProjectManager
        : strings.adminReview;

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{me?.fullName ?? currentUser?.fullName ?? common.loadingUser}</span>
            <span className="pill warn">{common.roleLane}: {currentRole ?? "Unknown"}</span>
            <span className="pill">{common.workspaceStandard}</span>
          </>
        }
        actions={
          <>
            <Link className="button secondary" href="/dashboard">
              {common.backToDashboard}
            </Link>
            <Link className="button ghost" href="/login">
              {common.switchAccount}
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
          <span className="muted">{locale === "en" ? "In review" : "İncelemede"}</span>
          <strong className="stat-value">{queueCounts.submitted + queueCounts.draft}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Resolved" : "Sonuçlanan"}</span>
          <strong className="stat-value">{queueCounts.approved + queueCounts.returned + queueCounts.rejected}</strong>
        </article>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <div className="card-header">
            <div>
              <p className="section-title">{strings.submittedFacts}</p>
            </div>
            <span className="pill">{facts.length} {common.records}</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{common.status}</th>
                  <th>{common.plan}</th>
                  <th>{locale === "en" ? "Numbers" : "Sayılar"}</th>
                  <th>{locale === "en" ? "Action" : "Aksiyon"}</th>
                </tr>
              </thead>
              <tbody>
                {facts.map((fact) => {
                  const plan = plans.find((item) => item.id === fact.dailyPlanId);
                  return (
                    <tr key={fact.id}>
                      <td><span className="pill">{fact.status}</span></td>
                      <td>
                        <div>{plan?.id ?? fact.dailyPlanId}</div>
                        <div className="muted">
                          {plan?.locationId ?? common.none} · {plan?.projectId ?? common.none}
                        </div>
                      </td>
                      <td>
                        <div>{fact.actualStatus}</div>
                        <div className="muted">{fact.factQuantity} / {fact.factManDay} / {fact.overtime}</div>
                      </td>
                      <td>
                        <button className="secondary" type="button" onClick={() => setSelectedFactId(fact.id)}>
                          {strings.loadButton}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {facts.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="notice">{strings.noSubmittedFacts}</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <p className="section-title">{strings.actionPanel}</p>

            <div className="notice" style={{ marginTop: 12 }}>
              <strong>{strings.selectedFactLabel}: {selectedFact?.id ?? common.none}</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {selectedPlan
                  ? `${selectedPlan.locationId} · ${selectedPlan.projectId} · ${selectedPlan.unit} · ${selectedPlan.plannedQuantity} / ${selectedPlan.plannedManDay}`
                  : strings.selectFactHint}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {currentRole
                  ? `${strings.rolePrefix}: ${currentRole} · ${
                      currentRole === "HEAD_OF_MASTER"
                        ? strings.approveHeadMaster
                        : currentRole === "SITE_CHIEF"
                          ? strings.approveSiteChief
                          : currentRole === "PROJECT_MANAGER"
                            ? strings.approveProjectManager
                            : locale === "en"
                              ? "Administrator review"
                              : "Yönetici inceleme modu"
                    }`
                  : strings.selectFactHint}
              </div>
            </div>

            <label className="field" style={{ marginTop: 16 }}>
              <span>{strings.commentLabel}</span>
              <textarea
                className="input"
                rows={4}
                value={comment}
                onChange={(event) => setComment(event.currentTarget.value)}
                placeholder={locale === "en" ? "Write a short reason or instruction..." : "Kısa bir gerekçe veya talimat yaz..."}
              />
              <small>{strings.commentHelp}</small>
            </label>

            {canReviewQueue ? (
              <div className="actions" style={{ marginTop: 16 }}>
                {approvalCapabilities.canApproveHeadMaster ? (
                  <button className="primary" type="button" onClick={() => act("head-master")} disabled={!selectedFactId}>
                    {decisionLabel}
                  </button>
                ) : null}
                {approvalCapabilities.canApproveSiteChief ? (
                  <button className="primary" type="button" onClick={() => act("site-chief")} disabled={!selectedFactId}>
                    {strings.approveSiteChief}
                  </button>
                ) : null}
                {approvalCapabilities.canApproveProjectManager ? (
                  <button className="primary" type="button" onClick={() => act("project-manager")} disabled={!selectedFactId}>
                    {strings.approveProjectManager}
                  </button>
                ) : null}
                {approvalCapabilities.canReturnForRevision ? (
                  <button className="secondary" type="button" onClick={() => act("return")} disabled={!selectedFactId}>
                    {strings.returnForRevision}
                  </button>
                ) : null}
                {approvalCapabilities.canReject ? (
                  <button className="ghost" type="button" onClick={() => act("reject")} disabled={!selectedFactId}>
                    {strings.reject}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="notice" style={{ marginTop: 16 }}>
                {strings.noApprovalActions}
              </div>
            )}
          </div>

          <div className="card pad">
            <p className="section-title">{strings.approvalHistory}</p>
            <div className="stack" style={{ marginTop: 12 }}>
              {history.map((item) => (
                <div key={item.id} className="notice">
                  <strong>{item.action}</strong> · {item.approverRole}
                  <div className="muted">{item.comment ?? common.noComment}</div>
                  <div className="muted">{formatDateTime(item.createdAt, locale)}</div>
                </div>
              ))}
              {history.length === 0 ? <div className="notice">{strings.historyHint}</div> : null}
            </div>
          </div>
        </div>
      </section>

      {message ? <section className="notice" style={{ marginTop: 18 }}>{message}</section> : null}
      {error ? <section className="notice danger" style={{ marginTop: 18 }}>{error}</section> : null}
    </main>
  );
}
