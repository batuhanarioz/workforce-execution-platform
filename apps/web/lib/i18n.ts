"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "en" | "tr";

const STORAGE_KEY = "wfp_locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "tr" ? "tr" : "en";
}

export function setStoredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return [context.locale, context.setLocale] as const;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
  };

  return createElement(LocaleContext.Provider, { value: { locale, setLocale } }, children);
}

export const copy = {
  en: {
    common: {
      backToOverview: "Back to overview",
      backToDashboard: "Dashboard",
      openPlanning: "Planning",
      openApprovals: "Approvals",
      switchAccount: "Switch account",
      desktopWorkspace: "Desktop workspace",
      loadingUser: "Loading user...",
      roleLane: "Role lane",
      currentUser: "Current user",
      records: "records",
      noRecords: "No records yet",
      none: "none",
      selectFirstFact: "Select a fact first.",
      unitNotLoaded: "unit not loaded",
      noComment: "No comment",
      selectedFact: "Selected fact",
      plan: "Plan",
      status: "Status",
      comment: "Comment",
      workspaceStandard: "Workspace standard",
      selectSavedPlanAndHeadFirst: "Select a saved plan and choose a Head of Master first.",
      planAssigned: "Plan assigned.",
      planInProgress: "Plan moved to in progress.",
      planCancelled: "Plan cancelled.",
    },
    login: {
      eyebrow: "Step 1 of 3 - Access",
      title: "Open the Akkuyu workspace.",
      subtitle: "Sign in and land on the matching workspace.",
      demoAccountsTitle: "Role accounts",
      demoAccountsHelp: "Pick a role to fill the login field.",
      signInTitle: "Sign in to continue",
      signInHelp: "Sign in with the role you want to use.",
      email: "Email",
      password: "Password",
      emailHelp: "Use one of the role accounts.",
      passwordHelp: "Use the matching credential pair.",
      enterWorkspace: "Sign in",
      signingIn: "Signing in...",
      whatHappensNextTitle: "What happens next",
      step1: "Dashboard shows the active role and scope.",
      step2: "Each role lands on its own surface.",
      step3: "The flow stays aligned with the case.",
    },
    dashboard: {
      eyebrow: "Operational overview",
      title: "See your next action.",
      lead: "Live counts, next action, no extra guidance.",
      openPlanning: "Planning",
      openApprovals: "Approvals",
      openExecution: "Execution",
      openReports: "Reports",
      manageUsers: "Manage users",
      nextTitle: "Immediate action",
      masterStatusTitle: "Live workspace state",
      masterStatusHelp: "Counts and metadata reflect live Prisma data.",
      nextTechnicalOffice: "Technical Office: plan and assign the day.",
      nextHeadOfMaster: "Head of Master: pick the plan and move the fact.",
      nextApprover: "Approvers: review, verify, and decide.",
    },
    adminUsers: {
      eyebrow: "Admin",
      title: "Manage users and access.",
      lead: "Search, filter, and control access.",
      action: "Dashboard",
      note: "Live directory",
      directoryTitle: "Directory control",
      directoryHelp:
        "Search by name, email, role, or location. The directory is backed by live auth data so the view stays operational.",
      roleSummary: "Role summary",
      accessSnapshot: "Access snapshot",
      selectedUserTitle: "Selected user",
      selectedUserHelp:
        "The selected row shows the current access footprint and what that user can reach.",
      controlNote: "The screen already behaves like an admin control surface.",
    },
    dailyReport: {
      eyebrow: "Reporting",
      title: "Daily reporting.",
      lead: "Approved rows, KPIs, filters, and export.",
      action: "Dashboard",
      note: "Reporting contract",
      reportContract: "Approved-only contract",
      activeFilters: "Active filters",
      selectedRowTitle: "Selected row",
      selectedRowHelp: "Source plan, unit, and variance stay visible.",
      sourceRecord: "Source record",
    },
    approvals: {
      eyebrow: "Approval lane",
      title: "Review one fact at a time.",
      lead: "Select, decide, and move on.",
      submittedFacts: "Approval queue",
      submittedFactsHelp: "Select a row to load the source record.",
      actionPanel: "Decision panel",
      actionPanelHelp: "Load a fact, inspect it, and decide.",
      approvalHistory: "Decision history",
      selectFactHint: "Select a fact from the queue first.",
      noSubmittedFacts: "No submitted facts yet.",
      loadButton: "Open",
      selectedFactLabel: "Selected fact",
      selectedPlan: "Source plan",
      selectedStatus: "Fact status",
      commentLabel: "Decision comment",
      commentHelp: "Keep the reason short and specific.",
      historyHint: "History appears after a fact is selected.",
      rolePrefix: "Role",
      adminReview: "Administrator review",
      noApprovalActions: "This role can view the queue, but it has no approval actions on this screen.",
      approveHeadMaster: "Approve as Head of Master",
      approveSiteChief: "Approve as Site Chief",
      approveProjectManager: "Approve as Project Manager",
      returnForRevision: "Return for revision",
      reject: "Reject",
      actionCompleted: "Decision saved.",
      sourceRecord: "Source record",
      decisionPath: "Decision path",
      queueSummary: "Queue summary",
    },
    dailyPlans: {
      eyebrow: "Daily plans",
      title: "Plan and assign the day.",
      lead: "Build the plan, assign it, move on.",
      currentUser: "Current user",
      editingExisting: "Editing an existing plan",
      creatingNew: "Creating a new plan",
      loadingMasterData: "Loading master data...",
      draftAssignedSummary: "Draft / assigned",
      executionReadySummary: "Execution ready",
      planForm: "Plan workspace",
      planFormHelp: "Select a saved plan to load it here.",
      assignmentPanel: "Assignment and status",
      assignmentHelp: "Assign a plan and move its status forward.",
      mainWorkspace: "Main workspace",
      optional: "Optional",
      section1: "1. Choose where the work will happen.",
      section2: "2. Choose the work hierarchy and the unit that the team will report.",
      section3: "3. Enter the quantities that define this plan.",
      location: "Location",
      locationHelp: "Use the exact project location. This keeps the plan in the right scope.",
      project: "Project",
      projectHelp: "Only projects tied to the selected location are shown.",
      typeOfWork: "Type of work",
      subTypeOfWork: "Sub type of work",
      subSubTypeOfWork: "Sub sub type",
      unit: "Unit",
      unitHelp: "Auto-filled from the selected sub sub type, but you can adjust it if needed.",
      plannedQuantity: "Planned quantity",
      plannedManDay: "Planned man-day",
      planDate: "Plan date",
      note: "Note",
      notePlaceholder: "Optional clarification for the team",
      createPlan: "Create plan",
      saveChanges: "Save changes",
      newPlan: "New plan",
      assignSelectedPlan: "Assign selected plan",
      startWork: "Start work",
      cancel: "Cancel",
      chooseUser: "Choose a user",
      headOfMasterLabel: "Head of Master",
      headOfMasterHelp: "Only users with the Head of Master role are shown here.",
      selectedPlan: "Selected plan",
      noPlanSelected: "none",
      statusGuide: "Status guide",
      statusDraft: "Draft",
      statusAssigned: "Assigned",
      statusInProgress: "In progress",
      statusFactSubmitted: "Fact submitted",
      savedPlans: "Saved plans",
      savedPlansHelp: "Use the row actions to load a plan back.",
      noDailyPlans: "No daily plans yet. Create the first one using the form above.",
      selectedPlanHint: "No plan selected. Choose one below.",
      selectedPlanSummary: (date: string, status: string, version: number) =>
        `Selected: ${date} / ${status} / version ${version}`,
      saveToKeepChanges: "Save to keep the changes.",
      load: "Load",
      loadedFromPrisma: () => "Live master data ready",
    },
  },
  tr: {
    common: {
      backToOverview: "Genel bakışa dön",
      backToDashboard: "Pano",
      openPlanning: "Planlama",
      openApprovals: "Onaylar",
      switchAccount: "Hesap değiştir",
      desktopWorkspace: "Masaüstü çalışma alanı",
      loadingUser: "Kullanıcı yükleniyor...",
      roleLane: "Rol alanı",
      currentUser: "Geçerli kullanıcı",
      records: "kayıt",
      noRecords: "Henüz kayıt yok",
      none: "yok",
      selectFirstFact: "Önce bir fiş seç.",
      unitNotLoaded: "birim yüklenmedi",
      noComment: "Yorum yok",
      selectedFact: "Seçili kayıt",
      plan: "Plan",
      status: "Durum",
      comment: "Yorum",
      workspaceStandard: "Çalışma alanı standardı",
      selectSavedPlanAndHeadFirst: "Önce kayıtlı bir plan seç ve bir Usta başı ata.",
      planAssigned: "Plan atandı.",
      planInProgress: "Plan devam ediyor durumuna alındı.",
      planCancelled: "Plan iptal edildi.",
    },
    login: {
      eyebrow: "Adım 1 / 3 - Erişim",
      title: "Akkuyu çalışma alanını aç.",
      subtitle: "Giriş yap ve ilgili çalışma alanına geç.",
      demoAccountsTitle: "Rol hesapları",
      demoAccountsHelp: "Bir rol seçerek giriş alanını doldur.",
      signInTitle: "Devam etmek için giriş yap",
      signInHelp: "İstediğin role ait hesabı kullan.",
      email: "E-posta",
      password: "Şifre",
      emailHelp: "Rol hesaplarından birini kullan.",
      passwordHelp: "Eşleşen kimlik bilgisini kullan.",
      enterWorkspace: "Giriş yap",
      signingIn: "Giriş yapılıyor...",
      whatHappensNextTitle: "Sonraki adım",
      step1: "Pano aktif rolü ve kapsamı gösterir.",
      step2: "Her rol kendi yüzeyine açılır.",
      step3: "Akış case ile hizalı kalır.",
    },
    dashboard: {
      eyebrow: "Çalışma alanı özeti",
      title: "Rolüne göre sıradaki hamleyi gör.",
      lead: "Sıradaki hattı ve canlı durumu gör.",
      openPlanning: "Planlama",
      openApprovals: "Onaylar",
      openExecution: "Yürütme",
      openReports: "Raporlar",
      manageUsers: "Kullanıcıları yönet",
      nextTitle: "Anlık aksiyon",
      masterStatusTitle: "Canlı çalışma alanı durumu",
      masterStatusHelp: "Sayılar canlı Prisma verisini yansıtır.",
      nextTechnicalOffice: "Technical Office: planla ve ata.",
      nextHeadOfMaster: "Usta başı: planı aç ve fişi gönder.",
      nextApprover: "Onaylayanlar: incele, doğrula, karar ver.",
    },
    adminUsers: {
      eyebrow: "Yönetici",
      title: "Platformu canlı dizinden yönet.",
      lead: "Kullanıcıları, rolleri ve erişimi yönet.",
      action: "Pano",
      note: "Canlı dizin",
      directoryTitle: "Dizin kontrolü",
      directoryHelp:
        "İsim, e-posta, rol veya lokasyon ile ara. Dizin canlı auth verisine bağlı olduğu için ekran operasyonel kalır.",
      roleSummary: "Rol özeti",
      accessSnapshot: "Erişim özeti",
      selectedUserTitle: "Seçili kullanıcı",
      selectedUserHelp:
        "Seçili satır, o kullanıcının erişim alanını ve nereye ulaşabildiğini gösterir.",
      controlNote: "Ekran şimdiden bir admin kontrol yüzeyi gibi davranıyor.",
    },
    dailyReport: {
      eyebrow: "Raporlama",
      title: "Günlük raporlama özeti.",
      lead: "Onaylı kayıtlar, filtreler, KPI’lar ve dışa aktarım tek yerde.",
      action: "Pano",
      note: "Raporlama sözleşmesi",
      reportContract: "Yalnızca onaylı kayıt sözleşmesi",
      activeFilters: "Aktif filtreler",
      selectedRowTitle: "Seçili satır",
      selectedRowHelp: "Kaynak plan, birim ve varyans birlikte görünür.",
      sourceRecord: "Kaynak kayıt",
    },
    approvals: {
      eyebrow: "Onay alanı",
      title: "Her seferinde bir fişi, kaynak kayıtla birlikte incele.",
      lead: "Bir fişi incele, karar ver, ilerlet.",
      submittedFacts: "Onay kuyruğu",
      submittedFactsHelp: "Kaynak kaydı açmak için bir satır seç.",
      actionPanel: "Karar paneli",
      actionPanelHelp: "Fişi yükle, incele ve karar ver.",
      approvalHistory: "Karar geçmişi",
      selectFactHint: "Önce kuyruktan bir fiş seç.",
      noSubmittedFacts: "Henüz gönderilen fiş yok.",
      loadButton: "İncele",
      selectedFactLabel: "Seçili fiş",
      selectedPlan: "Kaynak plan",
      selectedStatus: "Fiş durumu",
      commentLabel: "Karar yorumu",
      commentHelp: "Gerekçeyi kısa ve net tut.",
      historyHint: "Fiş seçildikten sonra geçmiş burada görünür.",
      rolePrefix: "Rol",
      adminReview: "Yönetici inceleme",
      noApprovalActions: "Bu rol kuyrugu görebilir, ancak bu ekranda onay aksiyonu kullanamaz.",
      approveHeadMaster: "Usta başı olarak onayla",
      approveSiteChief: "Site Chief olarak onayla",
      approveProjectManager: "Project Manager olarak onayla",
      returnForRevision: "Düzeltme için geri gönder",
      reject: "Reddet",
      actionCompleted: "Karar kaydedildi.",
      sourceRecord: "Kaynak kayıt",
      decisionPath: "Karar yolu",
      queueSummary: "Kuyruk özeti",
    },
    dailyPlans: {
      eyebrow: "Günlük planlar",
      title: "Planı tek çalışma alanında oluştur, ata ve gün içinde ilerlet.",
      lead: "Planı oluştur, ata, ilerlet.",
      currentUser: "Geçerli kullanıcı",
      editingExisting: "Mevcut planı düzenliyorsun",
      creatingNew: "Yeni plan oluşturuyorsun",
      loadingMasterData: "Master data yükleniyor...",
      draftAssignedSummary: "Taslak / atanmış",
      executionReadySummary: "Yürütmeye hazır",
      planForm: "Plan çalışma alanı",
      planFormHelp: "Alttan plan seçilince alan otomatik dolar.",
      assignmentPanel: "Atama ve durum",
      assignmentHelp: "Planı seç, ata ve durumunu ilerlet.",
      mainWorkspace: "Ana çalışma alanı",
      optional: "İsteğe bağlı",
      section1: "1. İşin nerede yapılacağını seç.",
      section2: "2. İş hiyerarşisini ve ekip raporlama birimini seç.",
      section3: "3. Bu planı tanımlayan miktarları gir.",
      location: "Lokasyon",
      locationHelp: "Projenin tam lokasyonunu kullan. Bu planı doğru kapsamda tutar.",
      project: "Proje",
      projectHelp: "Sadece seçili lokasyona bağlı projeler gösterilir.",
      typeOfWork: "İş türü",
      subTypeOfWork: "Alt iş türü",
      subSubTypeOfWork: "Alt alt iş türü",
      unit: "Birim",
      unitHelp: "Seçili alt alt tipten otomatik gelir, gerekirse değiştirebilirsin.",
      plannedQuantity: "Planlanan miktar",
      plannedManDay: "Planlanan adam-gün",
      planDate: "Plan tarihi",
      note: "Not",
      notePlaceholder: "Ekip için opsiyonel açıklama",
      createPlan: "Plan oluştur",
      saveChanges: "Değişiklikleri kaydet",
      newPlan: "Yeni plan",
      assignSelectedPlan: "Seçili planı ata",
      startWork: "İşi başlat",
      cancel: "İptal",
      chooseUser: "Kullanıcı seç",
      headOfMasterLabel: "Usta başı",
      headOfMasterHelp: "Burada yalnızca Usta başı rolündeki kullanıcılar gösterilir.",
      selectedPlan: "Seçili plan",
      noPlanSelected: "yok",
      statusGuide: "Durum rehberi",
      statusDraft: "Taslak",
      statusAssigned: "Atanmış",
      statusInProgress: "Devam ediyor",
      statusFactSubmitted: "Fiş gönderildi",
      savedPlans: "Kayıtlı planlar",
      savedPlansHelp: "Satır aksiyonlarıyla planı geri yükle.",
      noDailyPlans: "Henüz günlük plan yok. İlk planı yukarıdaki form ile oluştur.",
      selectedPlanHint: "Seçili plan yok. Alttan bir plan seç.",
      selectedPlanSummary: (date: string, status: string, version: number) =>
        `Seçili: ${date} / ${status} / sürüm ${version}`,
      saveToKeepChanges: "Değişiklikleri korumak için kaydet.",
      load: "Yükle",
      loadedFromPrisma: () =>
        "Canlı master data hazır",
    },
  },
} as const;

export function t(locale: Locale, scope: keyof typeof copy, key: string) {
  const value = (copy as any)[locale][scope]?.[key];
  return typeof value === "string" ? value : key;
}
