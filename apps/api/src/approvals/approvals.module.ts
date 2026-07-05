import { Module } from "@nestjs/common";
import { ApprovalsController } from "./approvals.controller";
import { DailyFactsModule } from "../daily-facts/daily-facts.module";
import { AuthModule } from "../auth/auth.module";
import { StateModule } from "../state/state.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [DailyFactsModule, AuthModule, StateModule, AuditLogsModule],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
