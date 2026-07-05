import { Inject, Injectable, Optional } from "@nestjs/common";
import { DataStateService } from "../state/data-state.service";
import { CacheService } from "../cache/cache.service";
import { DailyFactStatus, type DailyReportResponse, type DailyReportRow, type MasterDataSnapshot } from "@wfp/shared";

const REPORT_CACHE_TTL_SECONDS = 15;

type DailyReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  projectId?: string;
  typeOfWorkId?: string;
  subTypeOfWorkId?: string;
  subSubTypeOfWorkId?: string;
};

function isSameOrAfter(date: string, threshold: string) {
  return new Date(date).getTime() >= new Date(threshold).getTime();
}

function isSameOrBefore(date: string, threshold: string) {
  return new Date(date).getTime() <= new Date(threshold).getTime();
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DataStateService) private readonly state: DataStateService,
    @Optional() private readonly cache?: CacheService
  ) {}

  async daily(filters: DailyReportFilters = {}): Promise<{ success: true; data: DailyReportResponse }> {
    const cacheKey = `reports:daily:${JSON.stringify(filters)}`;
    const cached = await this.cache?.get<DailyReportResponse>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const [masterData, plans, facts] = await Promise.all([
      this.state.getMasterData(),
      this.state.listDailyPlans(),
      this.state.listDailyFacts(),
    ]);

    const rows = this.buildRows(masterData, plans, facts, filters);
    const summary = this.buildSummary(rows);
    const data = { rows, summary };
    await this.cache?.set(cacheKey, data, REPORT_CACHE_TTL_SECONDS);

    return {
      success: true,
      data,
    };
  }

  async kpis(filters: DailyReportFilters = {}) {
    const daily = await this.daily(filters);
    return {
      success: true,
      data: daily.data.summary,
    };
  }

  private buildRows(
    masterData: MasterDataSnapshot,
    plans: Awaited<ReturnType<DataStateService["listDailyPlans"]>>,
    facts: Awaited<ReturnType<DataStateService["listDailyFacts"]>>,
    filters: DailyReportFilters
  ): DailyReportRow[] {
    const locationById = new Map(masterData.locations.map((location) => [location.id, location]));
    const projectById = new Map(masterData.projects.map((project) => [project.id, project]));
    const typeOfWorkById = new Map(masterData.typeOfWorks.map((item) => [item.id, item]));
    const subTypeOfWorkById = new Map(masterData.subTypeOfWorks.map((item) => [item.id, item]));
    const subSubTypeOfWorkById = new Map(masterData.subSubTypeOfWorks.map((item) => [item.id, item]));

    const rows: DailyReportRow[] = [];

    for (const fact of facts) {
      if (fact.status !== DailyFactStatus.APPROVED_BY_PROJECT_MANAGER) {
        continue;
      }

      const plan = plans.find((item) => item.id === fact.dailyPlanId);
      if (!plan) {
        continue;
      }

      const location = locationById.get(plan.locationId);
      const project = projectById.get(plan.projectId);
      const typeOfWork = typeOfWorkById.get(plan.typeOfWorkId);
      const subTypeOfWork = subTypeOfWorkById.get(plan.subTypeOfWorkId);
      const subSubTypeOfWork = subSubTypeOfWorkById.get(plan.subSubTypeOfWorkId);

      if (!location || !project || !typeOfWork || !subTypeOfWork || !subSubTypeOfWork) {
        continue;
      }

      const planDate = plan.planDate;
      if (filters.dateFrom && !isSameOrAfter(planDate, filters.dateFrom)) {
        continue;
      }
      if (filters.dateTo && !isSameOrBefore(planDate, filters.dateTo)) {
        continue;
      }
      if (filters.locationId && plan.locationId !== filters.locationId) {
        continue;
      }
      if (filters.projectId && plan.projectId !== filters.projectId) {
        continue;
      }
      if (filters.typeOfWorkId && plan.typeOfWorkId !== filters.typeOfWorkId) {
        continue;
      }
      if (filters.subTypeOfWorkId && plan.subTypeOfWorkId !== filters.subTypeOfWorkId) {
        continue;
      }
      if (filters.subSubTypeOfWorkId && plan.subSubTypeOfWorkId !== filters.subSubTypeOfWorkId) {
        continue;
      }

      const quantityVariance = fact.factQuantity - plan.plannedQuantity;
      const manDayVariance = fact.factManDay - plan.plannedManDay;
      const productivityRatio = fact.factManDay > 0 ? fact.factQuantity / fact.factManDay : 0;

      rows.push({
        dailyPlanId: plan.id,
        dailyFactId: fact.id,
        planDate,
        locationId: location.id,
        locationCode: location.code,
        locationName: location.name,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        typeOfWorkId: typeOfWork.id,
        typeOfWorkCode: typeOfWork.code,
        typeOfWorkName: typeOfWork.name,
        subTypeOfWorkId: subTypeOfWork.id,
        subTypeOfWorkCode: subTypeOfWork.code,
        subTypeOfWorkName: subTypeOfWork.name,
        subSubTypeOfWorkId: subSubTypeOfWork.id,
        subSubTypeOfWorkCode: subSubTypeOfWork.code,
        subSubTypeOfWorkName: subSubTypeOfWork.name,
        unit: plan.unit,
        planStatus: plan.status,
        factStatus: fact.status,
        actualStatus: fact.actualStatus,
        plannedQuantity: plan.plannedQuantity,
        factQuantity: fact.factQuantity,
        plannedManDay: plan.plannedManDay,
        factManDay: fact.factManDay,
        overtime: fact.overtime,
        quantityVariance,
        manDayVariance,
        productivityRatio,
        submittedAt: fact.submittedAt,
      });
    }

    return rows.sort((left, right) => left.planDate.localeCompare(right.planDate));
  }

  private buildSummary(rows: DailyReportRow[]) {
    const totalPlannedQuantity = rows.reduce((sum, row) => sum + row.plannedQuantity, 0);
    const totalFactQuantity = rows.reduce((sum, row) => sum + row.factQuantity, 0);
    const totalPlannedManDay = rows.reduce((sum, row) => sum + row.plannedManDay, 0);
    const totalFactManDay = rows.reduce((sum, row) => sum + row.factManDay, 0);
    const totalOvertime = rows.reduce((sum, row) => sum + row.overtime, 0);

    return {
      totalPlannedQuantity,
      totalFactQuantity,
      totalPlannedManDay,
      totalFactManDay,
      totalOvertime,
      quantityCompletionRate: totalPlannedQuantity > 0 ? (totalFactQuantity / totalPlannedQuantity) * 100 : 0,
      productivityRatio: totalFactManDay > 0 ? totalFactQuantity / totalFactManDay : 0,
      rowCount: rows.length,
    };
  }
}
