import test from "node:test";
import assert from "node:assert/strict";
import { AuditLogsService } from "../src/audit-logs/audit-logs.service";
import { UserRole } from "@wfp/shared";
import type { PrismaService } from "../src/prisma/prisma.service";

const fakePrisma = {
  auditLog: {
    create: async (args: { data: unknown }) => ({
      id: "audit-1",
      userId: "user-1",
      entityType: "daily-plan",
      entityId: "plan-1",
      action: "PLAN_CREATED",
      oldValue: null,
      newValue: args.data,
      source: "web",
      locationId: "loc-1",
      requestId: "req-1",
      createdAt: new Date("2026-07-03T12:00:00.000Z"),
      user: {
        id: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        role: { name: UserRole.TECH_OFFICE },
      },
    }),
    findMany: async () => [
      {
        id: "audit-1",
        userId: "user-1",
        entityType: "daily-plan",
        entityId: "plan-1",
        action: "PLAN_CREATED",
        oldValue: null,
        newValue: { name: "Plan 1" },
        source: "web",
        locationId: "loc-1",
        requestId: "req-1",
        createdAt: new Date("2026-07-03T12:00:00.000Z"),
        user: {
          id: "user-1",
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          role: { name: UserRole.TECH_OFFICE },
        },
      },
    ],
    count: async () => 1,
  },
} as unknown as PrismaService;

test("audit log service records and lists normalized audit rows", async () => {
  const service = new AuditLogsService(fakePrisma);
  const created = await service.record({
    actor: {
      id: "user-1",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      role: UserRole.TECH_OFFICE,
    },
    entityType: "daily-plan",
    entityId: "plan-1",
    action: "PLAN_CREATED",
    source: "web",
    requestId: "req-1",
    locationId: "loc-1",
    newValue: { name: "Plan 1" },
  });

  assert.equal(created.id, "audit-1");
  assert.equal(created.user?.role, UserRole.TECH_OFFICE);
  assert.equal(created.source, "web");

  const listed = await service.list({ search: "ada", role: UserRole.TECH_OFFICE });
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0]?.action, "PLAN_CREATED");
  assert.equal(listed.data[0]?.entityType, "daily-plan");
  assert.equal(listed.pageInfo.totalCount, 1);
  assert.equal(listed.pageInfo.hasMore, false);
});

test("audit log service supports anonymous records for failed login attempts", async () => {
  const createCalls: Array<{ data: unknown }> = [];
  const service = new AuditLogsService({
    auditLog: {
      create: async (args: { data: unknown }) => {
        createCalls.push(args);
        return {
          id: "audit-2",
          userId: null,
          entityType: "auth",
          entityId: "unknown",
          action: "LOGIN_FAILED",
          oldValue: null,
          newValue: { email: "unknown", reason: "invalid_credentials" },
          source: "mobile",
          locationId: null,
          requestId: "req-2",
          createdAt: new Date("2026-07-03T12:00:00.000Z"),
          user: null,
        };
      },
      findMany: async () => [],
      count: async () => 0,
    },
  } as unknown as PrismaService);

  const created = await service.record({
    actor: null,
    entityType: "auth",
    entityId: "unknown",
    action: "LOGIN_FAILED",
    source: "mobile",
    requestId: "req-2",
    newValue: { email: "unknown", reason: "invalid_credentials" },
  });

  assert.equal(created.userId, null);
  assert.equal(created.action, "LOGIN_FAILED");
  assert.equal(createCalls.length, 1);
});
