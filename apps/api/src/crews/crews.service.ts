import { Inject, Injectable } from "@nestjs/common";
import { DataStateService } from "../state/data-state.service";
import { type CrewCreateInput, type WorkerAssignmentCreateInput } from "@wfp/shared";

@Injectable()
export class CrewsService {
  constructor(@Inject(DataStateService) private readonly state: DataStateService) {}

  async list() {
    return { success: true, data: await this.state.listCrews() };
  }

  async create(input: CrewCreateInput) {
    return { success: true, data: await this.state.createCrew(input) };
  }

  async listAssignments() {
    return { success: true, data: await this.state.listWorkerAssignments() };
  }

  async createAssignment(input: WorkerAssignmentCreateInput, assignedByUserId: string) {
    return { success: true, data: await this.state.createWorkerAssignment(input, assignedByUserId) };
  }
}
