import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ActualWorkStatus,
  ApprovalAction,
  DailyFactStatus,
  DailyPlanStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

type ImportData = {
  locations: Array<{ code: string; name: string; region?: string }>;
  projects: Array<{ code: string; name: string; locationCode: string }>;
  typeOfWorks: Array<{ code: string; name: string; sortOrder: number }>;
  subTypeOfWorks: Array<{ code: string; name: string; typeOfWorkCode: string; sortOrder: number }>;
  subSubTypeOfWorks: Array<{
    code: string;
    name: string;
    subTypeOfWorkCode: string;
    unit: string;
    typeCode: string;
    zzzCode?: string;
  }>;
  workerTypes: Array<{ name: string }>;
  zzzDetails: Array<{ code: string; name: string }>;
  demoUsers: Array<{ fullName: string; email: string; role: keyof typeof UserRole; locationCodes: string[] }>;
};

function requireItem<T>(item: T | undefined, label: string): T {
  if (!item) {
    throw new Error(`Missing seeded ${label}.`);
  }
  return item;
}

async function main() {
  const seedPath = join(__dirname, "wbs-import.json");
  const raw = readFileSync(seedPath, "utf8");
  const data = JSON.parse(raw) as ImportData;

  for (const roleName of Object.values(UserRole)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  for (const location of data.locations) {
    await prisma.location.upsert({
      where: { code: location.code },
      update: { name: location.name, region: location.region ?? null },
      create: { code: location.code, name: location.name, region: location.region ?? null },
    });
  }

  for (const project of data.projects) {
    const location = await prisma.location.findUnique({ where: { code: project.locationCode } });
    if (!location) continue;
    await prisma.project.upsert({
      where: { code: project.code },
      update: { name: project.name, locationId: location.id },
      create: { code: project.code, name: project.name, locationId: location.id },
    });
  }

  for (const tow of data.typeOfWorks) {
    await prisma.typeOfWork.upsert({
      where: { code: tow.code },
      update: { name: tow.name, sortOrder: tow.sortOrder },
      create: { code: tow.code, name: tow.name, sortOrder: tow.sortOrder },
    });
  }

  for (const stow of data.subTypeOfWorks) {
    const parent = await prisma.typeOfWork.findUnique({ where: { code: stow.typeOfWorkCode } });
    if (!parent) continue;
    await prisma.subTypeOfWork.upsert({
      where: { code: stow.code },
      update: { name: stow.name, typeOfWorkId: parent.id, sortOrder: stow.sortOrder },
      create: { code: stow.code, name: stow.name, typeOfWorkId: parent.id, sortOrder: stow.sortOrder },
    });
  }

  for (const sstow of data.subSubTypeOfWorks) {
    const parent = await prisma.subTypeOfWork.findUnique({ where: { code: sstow.subTypeOfWorkCode } });
    if (!parent) continue;
    await prisma.subSubTypeOfWork.upsert({
      where: { code: sstow.code },
      update: {
        name: sstow.name,
        subTypeOfWorkId: parent.id,
        unit: sstow.unit,
        typeCode: sstow.typeCode,
        zzzCode: sstow.zzzCode ?? null,
      },
      create: {
        code: sstow.code,
        name: sstow.name,
        subTypeOfWorkId: parent.id,
        unit: sstow.unit,
        typeCode: sstow.typeCode,
        zzzCode: sstow.zzzCode ?? null,
      },
    });
  }

  for (const workerType of data.workerTypes) {
    await prisma.workerType.upsert({
      where: { name: workerType.name },
      update: {},
      create: { name: workerType.name },
    });
  }

  for (const zzz of data.zzzDetails) {
    await prisma.zzzDetail.upsert({
      where: { code: zzz.code },
      update: { name: zzz.name },
      create: { code: zzz.code, name: zzz.name },
    });
  }

  for (const user of data.demoUsers) {
    const role = await prisma.role.findUnique({ where: { name: user.role } });
    if (!role) continue;
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, roleId: role.id },
      create: {
        fullName: user.fullName,
        email: user.email,
        passwordHash: "seeded-password",
        roleId: role.id,
      },
    });

    for (const locationCode of user.locationCodes) {
      const location = await prisma.location.findUnique({ where: { code: locationCode } });
      if (!location) continue;
      await prisma.userLocationAssignment.upsert({
        where: {
          userId_locationId: {
            userId: created.id,
            locationId: location.id,
          },
        },
        update: {},
        create: {
          userId: created.id,
          locationId: location.id,
          assignmentType: "LOCATION",
          isPrimary: true,
        },
      });
    }
  }

  const [locations, projects, typeOfWorks, subTypeOfWorks, subSubTypeOfWorks, workerTypes, zzzDetails, users] = await Promise.all([
    prisma.location.findMany(),
    prisma.project.findMany(),
    prisma.typeOfWork.findMany(),
    prisma.subTypeOfWork.findMany(),
    prisma.subSubTypeOfWork.findMany(),
    prisma.workerType.findMany(),
    prisma.zzzDetail.findMany(),
    prisma.user.findMany({ include: { role: true } }),
  ]);

  const locationByCode = new Map(locations.map((item) => [item.code, item]));
  const projectByCode = new Map(projects.map((item) => [item.code, item]));
  const towByCode = new Map(typeOfWorks.map((item) => [item.code, item]));
  const stowByCode = new Map(subTypeOfWorks.map((item) => [item.code, item]));
  const sstowByCode = new Map(subSubTypeOfWorks.map((item) => [item.code, item]));
  const workerTypeByName = new Map(workerTypes.map((item) => [item.name, item]));
  const zzzByCode = new Map(zzzDetails.map((item) => [item.code, item]));
  const userByEmail = new Map(users.map((item) => [item.email, item]));

  const techoffice = requireItem(userByEmail.get("techoffice@icn.com"), "Technical Office user");
  const hom = requireItem(userByEmail.get("hom@icn.com"), "Head Of Master user");
  const siteChief = requireItem(userByEmail.get("sitechief@icn.com"), "Site Chief user");
  const pm = requireItem(userByEmail.get("pm@icn.com"), "Project Manager user");

  const demoPlans = [
    {
      id: "demo-plan-tech-office-draft",
      planDate: new Date("2026-07-03T00:00:00.000Z"),
      locationCode: "30AAA",
      projectCode: "PRJ-30AAA",
      towCode: "TOW-01",
      stowCode: "STOW-04",
      sstowCode: "SSTOW-27",
      unit: "m2",
      plannedQuantity: "49",
      plannedManDay: "8",
      createdByUserId: techoffice.id,
      assignedHeadOfMasterId: null,
      status: DailyPlanStatus.DRAFT,
      note: "Technical Office draft plan for the presentation demo.",
    },
    {
      id: "demo-plan-head-master-assigned",
      planDate: new Date("2026-07-04T00:00:00.000Z"),
      locationCode: "30AAA",
      projectCode: "PRJ-30AAA",
      towCode: "TOW-02",
      stowCode: "STOW-23",
      sstowCode: "SSTOW-77",
      unit: "t",
      plannedQuantity: "4.92",
      plannedManDay: "33",
      createdByUserId: techoffice.id,
      assignedHeadOfMasterId: hom.id,
      status: DailyPlanStatus.ASSIGNED,
      note: "Assigned to Head Of Master with a ready crew allocation path.",
    },
    {
      id: "demo-plan-site-chief-review",
      planDate: new Date("2026-07-05T00:00:00.000Z"),
      locationCode: "30CCC",
      projectCode: "PRJ-30CCC",
      towCode: "TOW-03",
      stowCode: "STOW-51",
      sstowCode: "SSTOW-146",
      unit: "t",
      plannedQuantity: "9",
      plannedManDay: "14",
      createdByUserId: techoffice.id,
      assignedHeadOfMasterId: hom.id,
      status: DailyPlanStatus.FACT_SUBMITTED,
      note: "Submitted fact path for Site Chief review.",
    },
    {
      id: "demo-plan-pm-final",
      planDate: new Date("2026-07-06T00:00:00.000Z"),
      locationCode: "30BBB",
      projectCode: "PRJ-30BBB",
      towCode: "TOW-15",
      stowCode: "STOW-146",
      sstowCode: "SSTOW-411",
      unit: "m3",
      plannedQuantity: "25",
      plannedManDay: "3",
      createdByUserId: techoffice.id,
      assignedHeadOfMasterId: hom.id,
      status: DailyPlanStatus.REPORTED,
      note: "Final approved example used to show reporting readiness.",
    },
  ] as const;

  for (const plan of demoPlans) {
    const location = requireItem(locationByCode.get(plan.locationCode), `location ${plan.locationCode}`);
    const project = requireItem(projectByCode.get(plan.projectCode), `project ${plan.projectCode}`);
    const tow = requireItem(towByCode.get(plan.towCode), `type of work ${plan.towCode}`);
    const stow = requireItem(stowByCode.get(plan.stowCode), `sub type of work ${plan.stowCode}`);
    const sstow = requireItem(sstowByCode.get(plan.sstowCode), `sub sub type of work ${plan.sstowCode}`);

    await prisma.dailyPlan.upsert({
      where: { id: plan.id },
      update: {
        planDate: plan.planDate,
        locationId: location.id,
        projectId: project.id,
        typeOfWorkId: tow.id,
        subTypeOfWorkId: stow.id,
        subSubTypeOfWorkId: sstow.id,
        unit: plan.unit,
        plannedQuantity: new Prisma.Decimal(plan.plannedQuantity),
        plannedManDay: new Prisma.Decimal(plan.plannedManDay),
        assignedHeadOfMasterId: plan.assignedHeadOfMasterId,
        createdByUserId: plan.createdByUserId,
        status: plan.status,
        note: plan.note,
      },
      create: {
        id: plan.id,
        planDate: plan.planDate,
        locationId: location.id,
        projectId: project.id,
        typeOfWorkId: tow.id,
        subTypeOfWorkId: stow.id,
        subSubTypeOfWorkId: sstow.id,
        unit: plan.unit,
        plannedQuantity: new Prisma.Decimal(plan.plannedQuantity),
        plannedManDay: new Prisma.Decimal(plan.plannedManDay),
        assignedHeadOfMasterId: plan.assignedHeadOfMasterId,
        createdByUserId: plan.createdByUserId,
        status: plan.status,
        note: plan.note,
        version: 1,
      },
    });
  }

  const demoCrews = [
    {
      id: "demo-crew-30aaa-rebar",
      name: "30AAA Rebar Crew",
      locationCode: "30AAA",
      headOfMasterId: hom.id,
      workerTypeName: "Rebar Fixer",
    },
    {
      id: "demo-crew-30ccc-formwork",
      name: "30CCC Formwork Crew",
      locationCode: "30CCC",
      headOfMasterId: hom.id,
      workerTypeName: "Formworker",
    },
    {
      id: "demo-crew-30bbb-survey",
      name: "30BBB Survey Crew",
      locationCode: "30BBB",
      headOfMasterId: hom.id,
      workerTypeName: "Survey",
    },
  ] as const;

  for (const crew of demoCrews) {
    const location = requireItem(locationByCode.get(crew.locationCode), `location ${crew.locationCode}`);
    const workerType = requireItem(workerTypeByName.get(crew.workerTypeName), `worker type ${crew.workerTypeName}`);

    await prisma.crew.upsert({
      where: { id: crew.id },
      update: {
        name: crew.name,
        locationId: location.id,
        headOfMasterId: crew.headOfMasterId,
        workerTypeId: workerType.id,
        isActive: true,
      },
      create: {
        id: crew.id,
        name: crew.name,
        locationId: location.id,
        headOfMasterId: crew.headOfMasterId,
        workerTypeId: workerType.id,
        isActive: true,
      },
    });
  }

  const demoAssignments = [
    {
      id: "demo-assignment-plan-2",
      dailyPlanId: "demo-plan-head-master-assigned",
      crewId: "demo-crew-30aaa-rebar",
      workerTypeName: "Rebar Fixer",
      workerCount: 12,
      assignedByUserId: techoffice.id,
    },
    {
      id: "demo-assignment-plan-3",
      dailyPlanId: "demo-plan-site-chief-review",
      crewId: "demo-crew-30ccc-formwork",
      workerTypeName: "Formworker",
      workerCount: 8,
      assignedByUserId: hom.id,
    },
    {
      id: "demo-assignment-plan-4",
      dailyPlanId: "demo-plan-pm-final",
      crewId: "demo-crew-30bbb-survey",
      workerTypeName: "Survey",
      workerCount: 5,
      assignedByUserId: techoffice.id,
    },
  ] as const;

  for (const assignment of demoAssignments) {
    const workerType = requireItem(workerTypeByName.get(assignment.workerTypeName), `worker type ${assignment.workerTypeName}`);
    await prisma.workerAssignment.upsert({
      where: { id: assignment.id },
      update: {
        dailyPlanId: assignment.dailyPlanId,
        crewId: assignment.crewId,
        workerTypeId: workerType.id,
        workerCount: assignment.workerCount,
        assignedByUserId: assignment.assignedByUserId,
      },
      create: {
        id: assignment.id,
        dailyPlanId: assignment.dailyPlanId,
        crewId: assignment.crewId,
        workerTypeId: workerType.id,
        workerCount: assignment.workerCount,
        assignedByUserId: assignment.assignedByUserId,
      },
    });
  }

  const demoFacts = [
    {
      id: "demo-fact-plan-2",
      dailyPlanId: "demo-plan-head-master-assigned",
      factQuantity: "4.650",
      factManDay: "30.000",
      overtime: "0.500",
      actualStatus: ActualWorkStatus.COMPLETED,
      comment: "Crew mobilized and plan is ready for the next approval step.",
      zzzDetailCode: "60101508",
      submittedByUserId: hom.id,
      status: DailyFactStatus.DRAFT,
    },
    {
      id: "demo-fact-plan-3",
      dailyPlanId: "demo-plan-site-chief-review",
      factQuantity: "8.700",
      factManDay: "13.500",
      overtime: "0.000",
      actualStatus: ActualWorkStatus.PARTIALLY_COMPLETED,
      comment: "Submitted for Site Chief review with partial completion.",
      zzzDetailCode: "60114402",
      submittedByUserId: hom.id,
      status: DailyFactStatus.APPROVED_BY_SITE_CHIEF,
    },
    {
      id: "demo-fact-plan-4",
      dailyPlanId: "demo-plan-pm-final",
      factQuantity: "24.200",
      factManDay: "3.000",
      overtime: "0.000",
      actualStatus: ActualWorkStatus.COMPLETED,
      comment: "Final demo record approved through the full chain.",
      zzzDetailCode: "N/A",
      submittedByUserId: hom.id,
      status: DailyFactStatus.APPROVED_BY_PROJECT_MANAGER,
    },
  ] as const;

  for (const fact of demoFacts) {
    const zzzDetail = requireItem(zzzByCode.get(fact.zzzDetailCode), `ZZZ detail ${fact.zzzDetailCode}`);
    await prisma.dailyFact.upsert({
      where: { dailyPlanId: fact.dailyPlanId },
      update: {
        factQuantity: new Prisma.Decimal(fact.factQuantity),
        factManDay: new Prisma.Decimal(fact.factManDay),
        overtime: new Prisma.Decimal(fact.overtime),
        actualStatus: fact.actualStatus,
        comment: fact.comment,
        zzzDetailId: zzzDetail.id,
        submittedByUserId: fact.submittedByUserId,
        status: fact.status,
        submittedAt: new Date(),
      },
      create: {
        id: fact.id,
        dailyPlanId: fact.dailyPlanId,
        factQuantity: new Prisma.Decimal(fact.factQuantity),
        factManDay: new Prisma.Decimal(fact.factManDay),
        overtime: new Prisma.Decimal(fact.overtime),
        actualStatus: fact.actualStatus,
        comment: fact.comment,
        zzzDetailId: zzzDetail.id,
        submittedByUserId: fact.submittedByUserId,
        status: fact.status,
        submittedAt: new Date(),
        version: 1,
      },
    });
  }

  const approvalRows = [
    {
      id: "demo-approval-plan-3-hom",
      dailyFactId: "demo-fact-plan-3",
      approverUserId: hom.id,
      approverRole: UserRole.HEAD_OF_MASTER,
      comment: "Head Of Master reviewed the fact draft.",
    },
    {
      id: "demo-approval-plan-3-site-chief",
      dailyFactId: "demo-fact-plan-3",
      approverUserId: siteChief.id,
      approverRole: UserRole.SITE_CHIEF,
      comment: "Site Chief approved the submitted fact.",
    },
    {
      id: "demo-approval-plan-4-hom",
      dailyFactId: "demo-fact-plan-4",
      approverUserId: hom.id,
      approverRole: UserRole.HEAD_OF_MASTER,
      comment: "Head Of Master approved the final report.",
    },
    {
      id: "demo-approval-plan-4-site-chief",
      dailyFactId: "demo-fact-plan-4",
      approverUserId: siteChief.id,
      approverRole: UserRole.SITE_CHIEF,
      comment: "Site Chief approved the final report.",
    },
    {
      id: "demo-approval-plan-4-pm",
      dailyFactId: "demo-fact-plan-4",
      approverUserId: pm.id,
      approverRole: UserRole.PROJECT_MANAGER,
      comment: "Project Manager closed the approval chain.",
    },
  ] as const;

  for (const approval of approvalRows) {
    await prisma.approvalHistory.upsert({
      where: { id: approval.id },
      update: {
        dailyFactId: approval.dailyFactId,
        approverUserId: approval.approverUserId,
        approverRole: approval.approverRole,
        action: ApprovalAction.APPROVED,
        comment: approval.comment,
      },
      create: {
        id: approval.id,
        dailyFactId: approval.dailyFactId,
        approverUserId: approval.approverUserId,
        approverRole: approval.approverRole,
        action: ApprovalAction.APPROVED,
        comment: approval.comment,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
