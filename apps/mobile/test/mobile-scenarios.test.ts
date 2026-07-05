import assert from "node:assert/strict";
import {
  buildWelcomeMessage,
  persistLoginSession,
  resolveApiUrl,
  summarizeSyncResults,
} from "../lib/app-helpers";
import { getMobileRoleCapabilities, getMobileRoleOverviewKey, getMobileWorkspaceVisibility } from "../lib/role-flows";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => Promise<void> | void) {
  tests.push({ name, run });
}

test("resolveApiUrl honors explicit environment overrides", () => {
  assert.equal(
    resolveApiUrl({
      envUrl: "http://example.com/api",
      platform: "android",
      scriptUrl: "http://localhost:8081/index.bundle",
    }),
    "http://example.com/api"
  );
});

test("resolveApiUrl maps mobile localhost bundler hosts to the Android loopback bridge", () => {
  assert.equal(
    resolveApiUrl({
      platform: "android",
      scriptUrl: "http://localhost:8081/index.bundle?platform=android",
    }),
    "http://10.0.2.2:3001/api"
  );
});

test("resolveApiUrl preserves real device hosts and web defaults", () => {
  assert.equal(
    resolveApiUrl({
      platform: "android",
      scriptUrl: "http://192.168.1.20:8081/index.bundle",
    }),
    "http://192.168.1.20:3001/api"
  );

  assert.equal(
    resolveApiUrl({
      platform: "web",
      scriptUrl: "http://localhost:8081/index.bundle",
    }),
    "http://localhost:3001/api"
  );
});

test("buildWelcomeMessage keeps the login success message localized", () => {
  assert.equal(buildWelcomeMessage("en", "Ada"), "Welcome, Ada");
  assert.equal(buildWelcomeMessage("tr", "Ada"), "Hoş geldin, Ada");
});

test("persistLoginSession survives storage failures and reports success accurately", async () => {
  const saved: Array<{ token: string; deviceId: string }> = [];

  const success = await persistLoginSession(
    async (session) => {
      saved.push({ token: session.token, deviceId: session.deviceId });
    },
    { token: "token-1", user: { id: "user-1" }, deviceId: "device-1" }
  );

  assert.equal(success, true);
  assert.deepEqual(saved, [{ token: "token-1", deviceId: "device-1" }]);

  const failure = await persistLoginSession(
    async () => {
      throw new Error("storage unavailable");
    },
    { token: "token-2", user: { id: "user-2" }, deviceId: "device-2" }
  );

  assert.equal(failure, false);
});

test("summarizeSyncResults turns sync outcomes into concise user-facing copy", () => {
  const successSummary = summarizeSyncResults("en", [
    { status: "SYNCED" },
    { status: "DUPLICATE_IGNORED" },
  ]);
  assert.equal(successSummary.synced, 1);
  assert.equal(successSummary.duplicateIgnored, 1);
  assert.match(successSummary.message, /Workspace synced/);

  const issueSummary = summarizeSyncResults("tr", [
    { status: "SYNCED" },
    { status: "CONFLICT", message: "version mismatch" },
    { status: "FAILED", error: "network" },
  ]);
  assert.equal(issueSummary.conflicted, 1);
  assert.equal(issueSummary.failed, 1);
  assert.match(issueSummary.message, /işlem bekliyor/);
});

test("each mobile role sees the correct workspace blocks after login", () => {
  const cases = [
    {
      role: "TECH_OFFICE",
      overview: "techOfficeOverview",
      visibility: { showCrewWorkspace: false, showAssignmentWorkspace: false, showFactForm: false, showRoleHub: true },
      capabilities: { isHeadOfMaster: false, isTechOffice: true, isSiteChief: false, isProjectManager: false, isAdmin: false },
    },
    {
      role: "HEAD_OF_MASTER",
      overview: "headMasterOverview",
      visibility: { showCrewWorkspace: true, showAssignmentWorkspace: true, showFactForm: true, showRoleHub: false },
      capabilities: { isHeadOfMaster: true, isTechOffice: false, isSiteChief: false, isProjectManager: false, isAdmin: false },
    },
    {
      role: "SITE_CHIEF",
      overview: "siteChiefOverview",
      visibility: { showCrewWorkspace: false, showAssignmentWorkspace: false, showFactForm: false, showRoleHub: true },
      capabilities: { isHeadOfMaster: false, isTechOffice: false, isSiteChief: true, isProjectManager: false, isAdmin: false },
    },
    {
      role: "PROJECT_MANAGER",
      overview: "projectManagerOverview",
      visibility: { showCrewWorkspace: false, showAssignmentWorkspace: false, showFactForm: false, showRoleHub: true },
      capabilities: { isHeadOfMaster: false, isTechOffice: false, isSiteChief: false, isProjectManager: true, isAdmin: false },
    },
    {
      role: "ADMIN",
      overview: "adminOverview",
      visibility: { showCrewWorkspace: true, showAssignmentWorkspace: true, showFactForm: true, showRoleHub: false },
      capabilities: { isHeadOfMaster: false, isTechOffice: false, isSiteChief: false, isProjectManager: false, isAdmin: true },
    },
  ] as const;

  for (const scenario of cases) {
    assert.equal(getMobileRoleOverviewKey(scenario.role), scenario.overview);
    assert.deepEqual(getMobileWorkspaceVisibility(scenario.role), scenario.visibility);
    assert.deepEqual(getMobileRoleCapabilities(scenario.role), scenario.capabilities);
  }
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
