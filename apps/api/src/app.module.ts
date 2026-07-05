import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health/health.controller";
import { StateModule } from "./state/state.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { DailyPlansModule } from "./daily-plans/daily-plans.module";
import { DailyFactsModule } from "./daily-facts/daily-facts.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { SyncModule } from "./sync/sync.module";
import { CrewsModule } from "./crews/crews.module";
import { ReportsModule } from "./reports/reports.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RootController } from "./root.controller";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { CacheModule } from "./cache/cache.module";

@Module({
  imports: [
    AuthModule,
    StateModule,
    MasterDataModule,
    DailyPlansModule,
    CrewsModule,
    DailyFactsModule,
    ApprovalsModule,
    ReportsModule,
    SyncModule,
    AuditLogsModule,
    PrismaModule,
    CacheModule,
  ],
  controllers: [HealthController, RootController],
})
export class AppModule {}
