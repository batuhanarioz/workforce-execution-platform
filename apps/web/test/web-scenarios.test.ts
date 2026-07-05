import assert from "node:assert/strict";
import { ApiError, apiFetch, getStoredUser, getApiUrl } from "../lib/api";
import { copy, getStoredLocale, setStoredLocale, t } from "../lib/i18n";
import { getApprovalCapabilities, getDashboardPrimaryAction, getDashboardRoleText, getLoginLandingPath } from "../lib/role-flows";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => Promise<void> | void) {
  tests.push({ name, run });
}

function createLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    snapshot() {
      return Object.fromEntries(store.entries());
    },
  };
}

test("locale helpers read and write the browser locale consistently", () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const storage = createLocalStorage();
  const htmlElement = { lang: "en" };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
  };
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: htmlElement,
  };

  assert.equal(getStoredLocale(), "en");
  setStoredLocale("tr");
  assert.equal(getStoredLocale(), "tr");
  assert.equal(htmlElement.lang, "tr");

  (globalThis as unknown as { window?: unknown }).window = previousWindow;
  (globalThis as unknown as { document?: unknown }).document = previousDocument;
});

test("getStoredUser tolerates missing or malformed browser state", () => {
  const previousWindow = globalThis.window;
  (globalThis as unknown as { window: unknown }).window = undefined;
  assert.equal(getStoredUser(), null);

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: createLocalStorage({ wfp_user: "{not-json" }),
  };
  assert.equal(getStoredUser(), null);

  (globalThis as unknown as { window?: unknown }).window = previousWindow;
});

test("t returns translations and falls back to the key when missing", () => {
  assert.equal(t("en", "common", "openPlanning"), copy.en.common.openPlanning);
  assert.equal(t("tr", "common", "openApprovals"), copy.tr.common.openApprovals);
  assert.equal(t("en", "common", "missingKey"), "missingKey");
});

test("apiFetch attaches stored browser headers and returns JSON data", async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const storage = createLocalStorage({
    wfp_access_token: "token-1",
    wfp_user: JSON.stringify({
      id: "user-1",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      role: "ADMIN",
      locations: [{ id: "loc-1", code: "30AAA", name: "Location 30AAA" }],
    }),
  });

  (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer token-1");
    assert.equal(headers.get("x-user-id"), "user-1");
    assert.equal(headers.get("x-user-name"), "Ada Lovelace");
    assert.equal(headers.get("x-user-email"), "ada@example.com");
    assert.equal(headers.get("x-user-role"), "ADMIN");
    assert.equal(headers.get("x-user-location-id"), "loc-1");
    assert.equal(headers.get("x-user-location-code"), "30AAA");
    assert.equal(headers.get("x-user-location-name"), "Location 30AAA");

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await apiFetch<{ ok: boolean }>("/health");
  assert.equal(response.ok, true);

  (globalThis as unknown as { window?: unknown }).window = previousWindow;
  globalThis.fetch = previousFetch;
});

test("apiFetch maps error responses into friendly ApiError messages", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "raw api error" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => apiFetch("/secure"),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Your session ended. Please sign in again.");
      return true;
    }
  );

  globalThis.fetch = previousFetch;
});

test("each web role lands on the correct workspace and sees the correct action set", () => {
  const cases = [
    {
      role: "TECH_OFFICE",
      landing: "/daily-plans",
      actionHref: "/daily-plans",
      actionLabel: "Planning",
      roleTextEn: "Planning",
      roleTextTr: "Planlama",
      approvals: {
        canApproveHeadMaster: false,
        canApproveSiteChief: false,
        canApproveProjectManager: false,
        canReturnForRevision: false,
        canReject: false,
        canOpenAdminReview: false,
      },
    },
    {
      role: "HEAD_OF_MASTER",
      landing: "/head-of-master",
      actionHref: "/head-of-master",
      actionLabel: "Execution",
      roleTextEn: "Execution",
      roleTextTr: "Saha yürütme",
      approvals: {
        canApproveHeadMaster: true,
        canApproveSiteChief: false,
        canApproveProjectManager: false,
        canReturnForRevision: true,
        canReject: false,
        canOpenAdminReview: false,
      },
    },
    {
      role: "SITE_CHIEF",
      landing: "/site-chief",
      actionHref: "/reports/daily",
      actionLabel: "Reports",
      roleTextEn: "Site review",
      roleTextTr: "Şantiye inceleme",
      approvals: {
        canApproveHeadMaster: false,
        canApproveSiteChief: true,
        canApproveProjectManager: false,
        canReturnForRevision: true,
        canReject: true,
        canOpenAdminReview: false,
      },
    },
    {
      role: "PROJECT_MANAGER",
      landing: "/project-manager",
      actionHref: "/reports/daily",
      actionLabel: "Reports",
      roleTextEn: "Project review",
      roleTextTr: "Proje inceleme",
      approvals: {
        canApproveHeadMaster: false,
        canApproveSiteChief: false,
        canApproveProjectManager: true,
        canReturnForRevision: true,
        canReject: true,
        canOpenAdminReview: false,
      },
    },
    {
      role: "ADMIN",
      landing: "/admin/users",
      actionHref: "/admin/users",
      actionLabel: "Manage users",
      roleTextEn: "Admin",
      roleTextTr: "Yönetici",
      approvals: {
        canApproveHeadMaster: false,
        canApproveSiteChief: false,
        canApproveProjectManager: false,
        canReturnForRevision: false,
        canReject: true,
        canOpenAdminReview: true,
      },
    },
  ] as const;

  for (const scenario of cases) {
    assert.equal(getLoginLandingPath(scenario.role), scenario.landing);
    assert.deepEqual(getDashboardPrimaryAction(scenario.role), { href: scenario.actionHref, label: scenario.actionLabel });
    assert.equal(getDashboardRoleText("en", scenario.role), scenario.roleTextEn);
    assert.equal(getDashboardRoleText("tr", scenario.role), scenario.roleTextTr);
    assert.deepEqual(getApprovalCapabilities(scenario.role), scenario.approvals);
  }

  assert.equal(getLoginLandingPath("UNKNOWN"), "/dashboard");
  assert.deepEqual(getDashboardPrimaryAction("UNKNOWN"), { href: "/daily-plans", label: "Planning" });
});

async function main() {
  let passed = 0;

  for (const entry of tests) {
    try {
      await entry.run();
      passed += 1;
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      console.error(`not ok - ${entry.name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`1..${passed}`);
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

void main();
