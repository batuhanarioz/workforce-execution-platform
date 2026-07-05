import { Module } from "@nestjs/common";
import { SyncController } from "./sync.controller";
import { StateModule } from "../state/state.module";
import { AuthModule } from "../auth/auth.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";

@Module({
  imports: [StateModule, AuthModule, AuditLogsModule],
  controllers: [SyncController],
})
export class SyncModule {}
