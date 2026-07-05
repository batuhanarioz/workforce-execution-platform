import { Module } from "@nestjs/common";
import { DataStateService } from "./data-state.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [DataStateService],
  exports: [DataStateService],
})
export class StateModule {}
