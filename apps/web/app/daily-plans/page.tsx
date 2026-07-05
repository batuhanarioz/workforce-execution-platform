"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch, getStoredUser, type StoredUser } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";

type MasterData = {
  source: string;
  importedAt: string;
  locations: Array<{ id: string; code: string; name: string }>;
  projects: Array<{ id: string; code: string; name: string; locationId: string }>;
  typeOfWorks: Array<{ id: string; code: string; name: string; sortOrder: number }>;
  subTypeOfWorks: Array<{ id: string; code: string; name: string; typeOfWorkId: string; sortOrder: number }>;
  subSubTypeOfWorks: Array<{ id: string; code: string; name: string; subTypeOfWorkId: string; unit: string }>;
};

type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  locations: Array<{ id: string; code: string; name: string }>;
};

type DailyPlan = {
  id: string;
  planDate: string;
  locationId: string;
  projectId: string;
  typeOfWorkId: string;
  subTypeOfWorkId: string;
  subSubTypeOfWorkId: string;
  unit: string;
  plannedQuantity: number;
  plannedManDay: number;
  assignedHeadOfMasterId?: string;
  createdByUserId: string;
  status: string;
  note?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  planDate: today,
  locationId: "",
  projectId: "",
  typeOfWorkId: "",
  subTypeOfWorkId: "",
  subSubTypeOfWorkId: "",
  unit: "",
  plannedQuantity: "0",
  plannedManDay: "0",
  note: "",
};

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatPlanStatusLabel(status: string, locale: string) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");

  const labels: Record<string, { en: string; tr: string }> = {
    draft: { en: "Draft", tr: "Taslak" },
    assigned: { en: "Assigned", tr: "Atanmış" },
    in_progress: { en: "In progress", tr: "Devam ediyor" },
    fact_submitted: { en: "Fact submitted", tr: "Fiş gönderildi" },
    reported: { en: "Reported", tr: "Raporlandı" },
    approved: { en: "Approved", tr: "Onaylandı" },
    cancelled: { en: "Cancelled", tr: "İptal edildi" },
    rejected: { en: "Rejected", tr: "Reddedildi" },
  };

  const entry = labels[normalized];
  if (entry) {
    return entry[locale === "en" ? "en" : "tr"];
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatRoleLabel(value: string, locale: string) {
  const labels: Record<string, { en: string; tr: string }> = {
    "Technical Office": { en: "Technical Office", tr: "Teknik Ofis" },
    "Head of Master": { en: "Head of Master", tr: "Usta başı" },
    "Site Chief": { en: "Site Chief", tr: "Şantiye Şefi" },
    "Project Manager": { en: "Project Manager", tr: "Proje Yöneticisi" },
    Admin: { en: "Admin", tr: "Yönetici" },
  };

  const entry = labels[value];
  return entry ? entry[locale === "en" ? "en" : "tr"] : value;
}

export default function DailyPlansPage() {
  const router = useRouter();
  const [locale] = useLocale();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assignHeadId, setAssignHeadId] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [masterResponse, planResponse, directoryResponse] = await Promise.all([
          apiFetch<{ success: boolean; data: MasterData }>("/master-data"),
          apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans"),
          apiFetch<{ success: boolean; data: DirectoryUser[] }>("/auth/directory"),
        ]);
        setMasterData(masterResponse.data);
        setPlans(planResponse.data);
        setDirectory(directoryResponse.data);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : locale === "en" ? "Failed to load daily plans" : "Günlük planlar yüklenemedi");
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (!masterData) {
      return;
    }

    setForm((current) => {
      const next = { ...current };
      if (!next.locationId && masterData.locations[0]) next.locationId = masterData.locations[0].id;
      if (!next.projectId) {
        const matchedProject = masterData.projects.find((project) => project.locationId === next.locationId) ?? masterData.projects[0];
        if (matchedProject) next.projectId = matchedProject.id;
      }
      if (!next.typeOfWorkId && masterData.typeOfWorks[0]) next.typeOfWorkId = masterData.typeOfWorks[0].id;
      if (!next.subTypeOfWorkId) {
        const firstSubType = masterData.subTypeOfWorks.find((item) => item.typeOfWorkId === next.typeOfWorkId) ?? masterData.subTypeOfWorks[0];
        if (firstSubType) next.subTypeOfWorkId = firstSubType.id;
      }
      if (!next.subSubTypeOfWorkId) {
        const firstSubSubType = masterData.subSubTypeOfWorks.find((item) => item.subTypeOfWorkId === next.subTypeOfWorkId) ?? masterData.subSubTypeOfWorks[0];
        if (firstSubSubType) {
          next.subSubTypeOfWorkId = firstSubSubType.id;
          next.unit = next.unit || firstSubSubType.unit;
        }
      }
      return next;
    });
  }, [masterData]);

  useEffect(() => {
    if (!masterData || !form.locationId) return;
    const project = masterData.projects.find((item) => item.locationId === form.locationId);
    if (project) {
      setForm((current) => ({ ...current, projectId: project.id }));
    }
  }, [form.locationId, masterData]);

  useEffect(() => {
    if (!masterData || !form.typeOfWorkId) return;
    const firstSubType = masterData.subTypeOfWorks.find((item) => item.typeOfWorkId === form.typeOfWorkId);
    if (firstSubType) {
      setForm((current) => ({
        ...current,
        subTypeOfWorkId: firstSubType.id,
      }));
    }
  }, [form.typeOfWorkId, masterData]);

  useEffect(() => {
    if (!masterData || !form.subTypeOfWorkId) return;
    const firstSubSubType = masterData.subSubTypeOfWorks.find((item) => item.subTypeOfWorkId === form.subTypeOfWorkId);
    if (firstSubSubType) {
      setForm((current) => ({
        ...current,
        subSubTypeOfWorkId: firstSubSubType.id,
        unit: firstSubSubType.unit,
      }));
    }
  }, [form.subTypeOfWorkId, masterData]);

  function fillFromPlan(plan: DailyPlan) {
    setSelectedPlanId(plan.id);
    setAssignHeadId(plan.assignedHeadOfMasterId ?? "");
    setForm({
      planDate: plan.planDate.slice(0, 10),
      locationId: plan.locationId,
      projectId: plan.projectId,
      typeOfWorkId: plan.typeOfWorkId,
      subTypeOfWorkId: plan.subTypeOfWorkId,
      subSubTypeOfWorkId: plan.subSubTypeOfWorkId,
      unit: plan.unit,
      plannedQuantity: String(plan.plannedQuantity),
      plannedManDay: String(plan.plannedManDay),
      note: plan.note ?? "",
    });
  }

  function resetForm() {
    setSelectedPlanId("");
    setAssignHeadId("");
    setForm((current) => ({ ...emptyForm, locationId: current.locationId, projectId: current.projectId, typeOfWorkId: current.typeOfWorkId, subTypeOfWorkId: current.subTypeOfWorkId, subSubTypeOfWorkId: current.subSubTypeOfWorkId, unit: current.unit }));
  }

  async function savePlan() {
    setMessage("");
    setError("");

    if (!masterData) {
      setError(locale === "en" ? "Master data is not loaded yet." : "Master data henüz yüklenmedi.");
      return;
    }

    const payload = {
      planDate: form.planDate,
      locationId: form.locationId,
      projectId: form.projectId,
      typeOfWorkId: form.typeOfWorkId,
      subTypeOfWorkId: form.subTypeOfWorkId,
      subSubTypeOfWorkId: form.subSubTypeOfWorkId,
      unit: form.unit,
      plannedQuantity: Number(form.plannedQuantity),
      plannedManDay: Number(form.plannedManDay),
      note: form.note.trim() || undefined,
    };

    try {
      if (selectedPlanId) {
        await apiFetch(`/daily-plans/${selectedPlanId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage(locale === "en" ? "Daily plan updated." : "Günlük plan güncellendi.");
      } else {
        await apiFetch("/daily-plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage(locale === "en" ? "Daily plan created." : "Günlük plan oluşturuldu.");
      }

      const refreshed = await apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans");
      setPlans(refreshed.data);
      resetForm();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : locale === "en" ? "Unable to save plan" : "Plan kaydedilemedi");
    }
  }

  async function assignPlan() {
    if (!selectedPlanId || !assignHeadId) {
      setError(common.selectSavedPlanAndHeadFirst);
      return;
    }

    try {
      await apiFetch(`/daily-plans/${selectedPlanId}/assign`, {
        method: "POST",
        body: JSON.stringify({ assignedHeadOfMasterId: assignHeadId }),
      });
      const refreshed = await apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans");
      setPlans(refreshed.data);
      setMessage(common.planAssigned);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : locale === "en" ? "Unable to assign plan" : "Plan atanamadı");
    }
  }

  async function changeStatus(action: "start" | "cancel") {
    if (!selectedPlanId) return;

    try {
      await apiFetch(`/daily-plans/${selectedPlanId}/${action === "start" ? "start" : "cancel"}`, {
        method: "POST",
      });
      const refreshed = await apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans");
      setPlans(refreshed.data);
      setMessage(action === "start" ? common.planInProgress : common.planCancelled);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : locale === "en" ? "Unable to update status" : "Durum güncellenemedi");
    }
  }

  const selectedLocationProjects = masterData?.projects.filter((project) => project.locationId === form.locationId) ?? [];
  const selectedTypeSubTypes = masterData?.subTypeOfWorks.filter((item) => item.typeOfWorkId === form.typeOfWorkId) ?? [];
  const selectedSubTypeSubTypes = masterData?.subSubTypeOfWorks.filter((item) => item.subTypeOfWorkId === form.subTypeOfWorkId) ?? [];
  const homUsers = directory.filter((user) => user.role === "HEAD_OF_MASTER");
  const statusCounts = useMemo(() => {
    return plans.reduce(
      (acc, plan) => {
        const key = plan.status.toLowerCase();
        acc.total += 1;
        if (key in acc) {
          acc[key as keyof Omit<typeof acc, "total">] += 1;
        }
        return acc;
      },
      { total: 0, draft: 0, assigned: 0, in_progress: 0, fact_submitted: 0 }
    );
  }, [plans]);
  const strings = copy[locale].dailyPlans;
  const common = copy[locale].common;

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">
              {currentUser?.fullName
                ? currentUser.fullName
                : currentUser?.email ?? common.loadingUser}
            </span>
            <span className="pill warn">{selectedPlanId ? strings.editingExisting : strings.creatingNew}</span>
            <span className="pill">
              {masterData ? strings.loadedFromPrisma() : strings.loadingMasterData}
            </span>
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
          <span className="muted">{locale === "en" ? "Saved plans" : "Kayıtlı planlar"}</span>
          <strong className="stat-value">{statusCounts.total}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.draftAssignedSummary}</span>
          <strong className="stat-value">{statusCounts.draft + statusCounts.assigned}</strong>
        </article>
        <article className="stat">
          <span className="muted">{strings.executionReadySummary}</span>
          <strong className="stat-value">{statusCounts.in_progress + statusCounts.fact_submitted}</strong>
        </article>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
            <div className="card-header">
              <div>
                <p className="section-title">{strings.planForm}</p>
              </div>
            <span className="pill">{strings.mainWorkspace}</span>
          </div>

          <div className="stack">
            <div className="field-grid">
              <label className="field">
                <span>{strings.location}</span>
                <select
                  className="input"
                  value={form.locationId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, locationId: value }));
                  }}
                >
                  {masterData?.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} - {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{strings.project}</span>
                <select
                  className="input"
                  value={form.projectId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, projectId: value }));
                  }}
                >
                  {selectedLocationProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} - {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>{strings.typeOfWork}</span>
                <select
                  className="input"
                  value={form.typeOfWorkId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, typeOfWorkId: value }));
                  }}
                >
                  {masterData?.typeOfWorks.map((typeOfWork) => (
                    <option key={typeOfWork.id} value={typeOfWork.id}>
                      {typeOfWork.code} - {typeOfWork.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{strings.subTypeOfWork}</span>
                <select
                  className="input"
                  value={form.subTypeOfWorkId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, subTypeOfWorkId: value }));
                  }}
                >
                  {selectedTypeSubTypes.map((subType) => (
                    <option key={subType.id} value={subType.id}>
                      {subType.code} - {subType.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>{strings.subSubTypeOfWork}</span>
                <select
                  className="input"
                  value={form.subSubTypeOfWorkId}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, subSubTypeOfWorkId: value }));
                  }}
                >
                  {selectedSubTypeSubTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>{strings.unit}</span>
                <input
                  className="input"
                  value={form.unit}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, unit: value }));
                  }}
                  placeholder="m3, m2, ton, pcs..."
                />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>{strings.plannedQuantity}</span>
                <input
                  className="input"
                  type="number"
                  value={form.plannedQuantity}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, plannedQuantity: value }));
                  }}
                />
              </label>

              <label className="field">
                <span>{strings.plannedManDay}</span>
                <input
                  className="input"
                  type="number"
                  value={form.plannedManDay}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, plannedManDay: value }));
                  }}
                />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>{strings.planDate}</span>
                <input
                  className="input"
                  type="date"
                  value={form.planDate}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, planDate: value }));
                  }}
                />
              </label>

              <label className="field">
                <span>{strings.note}</span>
                <input
                  className="input"
                  value={form.note}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, note: value }));
                  }}
                  placeholder={strings.notePlaceholder}
                />
              </label>
            </div>

            <div className="actions">
              <button className="primary" type="button" onClick={savePlan}>
                {selectedPlanId ? strings.saveChanges : strings.createPlan}
              </button>
              <button className="secondary" type="button" onClick={resetForm}>
                {strings.newPlan}
              </button>
            </div>

            {selectedPlanId ? (
              <div className="notice warn">
                {strings.editingExisting}: {formatPlanStatusLabel(selectedPlan?.status ?? selectedPlanId, locale)}. {strings.saveToKeepChanges}
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <div className="card-header">
              <div>
                <p className="section-title">{strings.assignmentPanel}</p>
              </div>
              <span className="pill">{strings.optional}</span>
            </div>

            {selectedPlan ? (
              <div className="notice" style={{ marginBottom: 14 }}>
                {strings.selectedPlanSummary(
                  formatDate(selectedPlan.planDate, locale),
                  formatPlanStatusLabel(selectedPlan.status, locale),
                  selectedPlan.version
                )}
              </div>
            ) : null}

            <label className="field">
              <span>{strings.headOfMasterLabel}</span>
              <select
                className="input"
                value={assignHeadId}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setAssignHeadId(value);
                }}
              >
                <option value="">{strings.chooseUser}</option>
                {homUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatRoleLabel(user.fullName, locale)} - {user.email}
                  </option>
                ))}
              </select>
            </label>

            <div className="actions" style={{ marginTop: 16 }}>
              <button className="primary" type="button" onClick={assignPlan} disabled={!selectedPlanId}>
                {strings.assignSelectedPlan}
              </button>
              <button className="secondary" type="button" onClick={() => changeStatus("start")} disabled={!selectedPlanId}>
                {strings.startWork}
              </button>
              <button className="ghost" type="button" onClick={() => changeStatus("cancel")} disabled={!selectedPlanId}>
                {strings.cancel}
              </button>
            </div>

          </div>

        </div>
      </section>

      <section className="card pad" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <p className="section-title">{strings.savedPlans}</p>
          </div>
          <span className="pill">{plans.length} {common.records}</span>
        </div>

        {error ? <div className="notice danger" style={{ marginBottom: 14 }}>{error}</div> : null}
        {message ? <div className="notice" style={{ marginBottom: 14 }}>{message}</div> : null}

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>{locale === "en" ? "Date" : "Tarih"}</th>
                <th>{locale === "en" ? "Location / Project" : "Lokasyon / Proje"}</th>
                <th>{locale === "en" ? "Work" : "İş"}</th>
                <th>{locale === "en" ? "Numbers" : "Sayılar"}</th>
                <th>{common.status}</th>
                <th>{locale === "en" ? "Action" : "Aksiyon"}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>{formatDate(plan.planDate, locale)}</td>
                  <td>
                    <div>{masterData?.locations.find((item) => item.id === plan.locationId)?.name ?? plan.locationId}</div>
                    <div className="muted">{masterData?.projects.find((item) => item.id === plan.projectId)?.name ?? plan.projectId}</div>
                  </td>
                  <td>
                    <div>{masterData?.typeOfWorks.find((item) => item.id === plan.typeOfWorkId)?.name ?? plan.typeOfWorkId}</div>
                    <div className="muted">{masterData?.subSubTypeOfWorks.find((item) => item.id === plan.subSubTypeOfWorkId)?.name ?? plan.subSubTypeOfWorkId}</div>
                  </td>
                  <td>
                    <div>{plan.plannedQuantity} {plan.unit}</div>
                    <div className="muted">{plan.plannedManDay} {locale === "en" ? "man-day" : "adam-gün"}</div>
                  </td>
                  <td>
                    <span className="pill">{formatPlanStatusLabel(plan.status, locale)}</span>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="secondary" type="button" onClick={() => fillFromPlan(plan)}>
                        {strings.load}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="notice">{strings.noDailyPlans}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
