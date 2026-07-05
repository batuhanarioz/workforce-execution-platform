import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [StateModule, AuthModule, AuditLogsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
