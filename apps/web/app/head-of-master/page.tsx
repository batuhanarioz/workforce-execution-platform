"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader } from "../../components/workspace-header";
import { ApiError, apiFetch, type StoredUser, getStoredUser } from "../../lib/api";
import { copy, useLocale } from "../../lib/i18n";

type MasterData = {
  locations: Array<{ id: string; code: string; name: string }>;
  workerTypes: Array<{ id: string; name: string }>;
};

type DailyPlan = {
  id: string;
  planDate: string;
  locationId: string;
  projectId: string;
  unit: string;
  status: string;
};

type Crew = {
  id: string;
  name: string;
  locationId: string;
  headOfMasterId: string;
  workerTypeId: string;
  isActive: boolean;
  createdAt: string;
};

type WorkerAssignment = {
  id: string;
  dailyPlanId: string;
  crewId: string;
  workerTypeId: string;
  workerCount: number;
  assignedByUserId: string;
  createdAt: string;
};

export default function HeadOfMasterPage() {
  const [locale] = useLocale();
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [crewName, setCrewName] = useState("");
  const [crewLocationId, setCrewLocationId] = useState("");
  const [crewWorkerTypeId, setCrewWorkerTypeId] = useState("");
  const [assignmentPlanId, setAssignmentPlanId] = useState("");
  const [assignmentCrewId, setAssignmentCrewId] = useState("");
  const [assignmentWorkerTypeId, setAssignmentWorkerTypeId] = useState("");
  const [assignmentCount, setAssignmentCount] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  const strings = locale === "en"
    ? {
        eyebrow: "Execution",
        title: "Keep the mobile lane ready.",
        lead: "Prepare crews, attach them, keep execution ready.",
        crewPanel: "Crew workspace",
        assignmentPanel: "Assignment queue",
        crewsTitle: "Available crews",
        assignmentsTitle: "Current queue",
        createCrew: "Create crew",
        assignWorkers: "Assign workers",
        name: "Crew name",
        location: "Location",
        workerType: "Worker type",
        plan: "Daily plan",
        crew: "Crew",
        count: "Worker count",
        openDailyPlans: "Planning",
        openApprovals: "Approvals",
        backToDashboard: "Dashboard",
        currentUser: "Current user",
        noCrews: "No crews yet.",
        noAssignments: "No worker assignments yet.",
        live: "Live",
        offline: "Offline",
        queueReady: "Queue ready",
        selectPlanHint: "Pick a plan and crew to keep the field queue aligned.",
        activePlan: "Active plan",
        activeCrew: "Active crew",
      }
    : {
        eyebrow: "Saha yürütme",
        title: "Mobil hattı hazır tut.",
        lead: "Ekipleri kur, plana bağla, yürütmeyi hazır tut.",
        crewPanel: "Crew alanı",
        assignmentPanel: "Atama kuyruğu",
        crewsTitle: "Hazır crew'ler",
        assignmentsTitle: "Mevcut kuyruk",
        createCrew: "Crew oluştur",
        assignWorkers: "Worker ata",
        name: "Crew adı",
        location: "Lokasyon",
        workerType: "Worker type",
        plan: "Günlük plan",
        crew: "Crew",
        count: "Worker count",
        openDailyPlans: "Planlama",
        openApprovals: "Onaylar",
        backToDashboard: "Pano",
        currentUser: "Geçerli kullanıcı",
        noCrews: "Henüz crew yok.",
        noAssignments: "Henüz atama yok.",
        live: "Canlı",
        offline: "Çevrimdışı",
        queueReady: "Kuyruk hazır",
        selectPlanHint: "Saha kuyruğunu hizalamak için bir plan ve crew seç.",
        activePlan: "Aktif plan",
        activeCrew: "Aktif crew",
      };
  const common = copy[locale].common;

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, masterResponse, plansResponse, crewsResponse, assignmentsResponse] =
          await Promise.all([
            apiFetch<{ success: boolean; data: StoredUser | null }>("/auth/me"),
            apiFetch<{ success: boolean; data: MasterData }>("/master-data"),
            apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans"),
            apiFetch<{ success: boolean; data: Crew[] }>("/crews"),
            apiFetch<{ success: boolean; data: WorkerAssignment[] }>("/worker-assignments"),
          ]);

        setCurrentUser(meResponse.data ?? getStoredUser());
        setMasterData(masterResponse.data);
        setPlans(plansResponse.data);
        setCrews(crewsResponse.data);
        setAssignments(assignmentsResponse.data);
        setCrewLocationId((current) => current || masterResponse.data.locations[0]?.id || "");
        setCrewWorkerTypeId((current) => current || masterResponse.data.workerTypes[0]?.id || "");
        setAssignmentWorkerTypeId((current) => current || masterResponse.data.workerTypes[0]?.id || "");
        setAssignmentPlanId((current) => current || plansResponse.data[0]?.id || "");
        setAssignmentCrewId((current) => current || crewsResponse.data[0]?.id || "");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401)) {
          window.location.href = "/login";
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load head of master lane");
      }
    }

    load();
  }, []);

  async function refreshLists() {
    const [plansResponse, crewsResponse, assignmentsResponse] = await Promise.all([
      apiFetch<{ success: boolean; data: DailyPlan[] }>("/daily-plans"),
      apiFetch<{ success: boolean; data: Crew[] }>("/crews"),
      apiFetch<{ success: boolean; data: WorkerAssignment[] }>("/worker-assignments"),
    ]);
    setPlans(plansResponse.data);
    setCrews(crewsResponse.data);
    setAssignments(assignmentsResponse.data);
  }

  async function createCrew() {
    if (!currentUser?.id || !crewName.trim() || !crewLocationId || !crewWorkerTypeId) {
      setError(locale === "en" ? "Fill all crew fields first." : "Önce crew alanlarını doldur.");
      return;
    }

    try {
      await apiFetch("/crews", {
        method: "POST",
        body: JSON.stringify({
          name: crewName.trim(),
          locationId: crewLocationId,
          headOfMasterId: currentUser.id,
          workerTypeId: crewWorkerTypeId,
        }),
      });
      setMessage(locale === "en" ? "Crew created." : "Crew oluşturuldu.");
      setCrewName("");
      await refreshLists();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to create crew");
    }
  }

  async function assignWorkers() {
    if (!assignmentPlanId || !assignmentCrewId || !assignmentWorkerTypeId) {
      setError(locale === "en" ? "Select plan, crew, and worker type." : "Plan, crew ve worker type seç.");
      return;
    }

    try {
      await apiFetch("/worker-assignments", {
        method: "POST",
        body: JSON.stringify({
          dailyPlanId: assignmentPlanId,
          crewId: assignmentCrewId,
          workerTypeId: assignmentWorkerTypeId,
          workerCount: Number(assignmentCount || 0),
        }),
      });
      setMessage(locale === "en" ? "Assignment saved." : "Atama kaydedildi.");
      await refreshLists();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401)) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to save assignment");
    }
  }

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === assignmentPlanId) ?? null, [plans, assignmentPlanId]);
  const selectedCrew = useMemo(() => crews.find((crew) => crew.id === assignmentCrewId) ?? null, [crews, assignmentCrewId]);
  const readyCount = plans.filter((plan) => plan.status === "ASSIGNED" || plan.status === "IN_PROGRESS").length;

  return (
    <main className="page-shell">
      <WorkspaceHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        lead={strings.lead}
        meta={
          <>
            <span className="pill">{currentUser?.fullName ?? common.loadingUser}</span>
            <span className="pill warn">{common.roleLane}: HEAD_OF_MASTER</span>
            <span className="pill">{common.workspaceStandard}</span>
            <span className={`pill ${isOnline ? "" : "warn"}`}>{isOnline ? strings.live : strings.offline}</span>
          </>
        }
        actions={
          <>
            <Link className="button secondary" href="/dashboard">
              {strings.backToDashboard}
            </Link>
            <Link className="button ghost" href="/login">
              {common.switchAccount}
            </Link>
          </>
        }
      />

      <section className="grid cols-3" style={{ marginTop: 18 }}>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Plans ready" : "Hazır planlar"}</span>
          <strong className="stat-value">{readyCount}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Active crews" : "Aktif crew'ler"}</span>
          <strong className="stat-value">{crews.filter((crew) => crew.isActive).length}</strong>
        </article>
        <article className="stat">
          <span className="muted">{locale === "en" ? "Assignments" : "Atamalar"}</span>
          <strong className="stat-value">{assignments.length}</strong>
        </article>
      </section>

      <section className="card pad" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <p className="section-title">{strings.queueReady}</p>
          </div>
          <span className="pill">
            {strings.activePlan}: {selectedPlan?.id ?? (locale === "en" ? "none" : "yok")}
          </span>
        </div>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div className="notice">
            <strong>{strings.activePlan}</strong>
            <div className="muted">
              {selectedPlan
                ? `${selectedPlan.planDate.slice(0, 10)} · ${selectedPlan.status} · ${selectedPlan.unit}`
                : locale === "en"
                  ? "No plan selected."
                  : "Plan seçilmedi."}
            </div>
          </div>
          <div className="notice">
            <strong>{strings.activeCrew}</strong>
            <div className="muted">
              {selectedCrew
                ? `${selectedCrew.name} · ${selectedCrew.isActive ? (locale === "en" ? "active" : "aktif") : (locale === "en" ? "inactive" : "pasif")}`
                : locale === "en"
                  ? "No crew selected."
                  : "Crew seçilmedi."}
            </div>
          </div>
          <div className="notice">
            <strong>{locale === "en" ? "Execution state" : "Yürütme durumu"}</strong>
            <div className="muted">
              {isOnline
                ? locale === "en"
                  ? "Live connection available for updates."
                  : "Güncellemeler için canlı bağlantı hazır."
                : locale === "en"
                  ? "Offline mode detected. Hold updates locally."
                  : "Çevrimdışı mod algılandı. Güncellemeleri yerelde tut."}
            </div>
          </div>
        </div>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <p className="section-title">{strings.crewPanel}</p>
          <div className="field-grid" style={{ marginTop: 14 }}>
            <label className="field">
              <span>{strings.name}</span>
              <input className="input" value={crewName} onChange={(e) => setCrewName(e.currentTarget.value)} placeholder="North crew" />
            </label>
            <label className="field">
              <span>{strings.location}</span>
              <select className="input" value={crewLocationId} onChange={(e) => setCrewLocationId(e.currentTarget.value)}>
                {masterData?.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field" style={{ marginTop: 14 }}>
            <span>{strings.workerType}</span>
            <select className="input" value={crewWorkerTypeId} onChange={(e) => setCrewWorkerTypeId(e.currentTarget.value)}>
              {masterData?.workerTypes.map((workerType) => (
                <option key={workerType.id} value={workerType.id}>
                  {workerType.name}
                </option>
              ))}
            </select>
          </label>
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="primary" type="button" onClick={createCrew}>{strings.createCrew}</button>
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{strings.assignmentPanel}</p>
          <div className="stack" style={{ marginTop: 14 }}>
            <label className="field">
              <span>{strings.plan}</span>
              <select className="input" value={assignmentPlanId} onChange={(e) => setAssignmentPlanId(e.currentTarget.value)}>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.planDate.slice(0, 10)} - {plan.unit} - {plan.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{strings.crew}</span>
              <select className="input" value={assignmentCrewId} onChange={(e) => setAssignmentCrewId(e.currentTarget.value)}>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{strings.workerType}</span>
              <select className="input" value={assignmentWorkerTypeId} onChange={(e) => setAssignmentWorkerTypeId(e.currentTarget.value)}>
                {masterData?.workerTypes.map((workerType) => (
                  <option key={workerType.id} value={workerType.id}>
                    {workerType.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{strings.count}</span>
              <input className="input" type="number" min="1" value={assignmentCount} onChange={(e) => setAssignmentCount(e.currentTarget.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 16 }}>
            <button className="primary" type="button" onClick={assignWorkers}>{strings.assignWorkers}</button>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            {locale === "en"
              ? `Plan: ${selectedPlan?.id ?? "none"} · Crew: ${selectedCrew?.name ?? "none"}`
              : `Plan: ${selectedPlan?.id ?? "yok"} · Crew: ${selectedCrew?.name ?? "yok"}`}
          </p>
        </div>
      </section>

      <section className="split" style={{ marginTop: 18 }}>
        <div className="card pad">
          <p className="section-title">{strings.crewsTitle}</p>
          <div className="stack" style={{ marginTop: 12 }}>
            {crews.map((crew) => (
              <div key={crew.id} className="notice">
                <strong>{crew.name}</strong>
                <div className="muted">
                  {crew.locationId} · {crew.workerTypeId} · {crew.isActive ? (locale === "en" ? "active" : "aktif") : (locale === "en" ? "inactive" : "pasif")}
                </div>
              </div>
            ))}
            {crews.length === 0 ? <div className="notice">{strings.noCrews}</div> : null}
          </div>
        </div>

        <div className="card pad">
          <p className="section-title">{strings.assignmentsTitle}</p>
          <div className="stack" style={{ marginTop: 12 }}>
            {assignments.map((assignment) => (
              <div key={assignment.id} className="notice">
                <strong>{assignment.dailyPlanId}</strong>
                <div className="muted">
                  {assignment.crewId} · {assignment.workerTypeId} · {assignment.workerCount}
                </div>
              </div>
            ))}
            {assignments.length === 0 ? <div className="notice">{strings.noAssignments}</div> : null}
          </div>
        </div>
      </section>

      {message ? <section className="notice" style={{ marginTop: 18 }}>{message}</section> : null}
      {error ? <section className="notice danger" style={{ marginTop: 18 }}>{error}</section> : null}
    </main>
  );
}
