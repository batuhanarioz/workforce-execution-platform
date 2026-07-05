import { Controller, Get } from "@nestjs/common";

@Controller()
export class RootController {
  @Get()
  root() {
    return {
      success: true,
      data: {
        status: "ok",
        service: "workforce-execution-platform-api",
        docs: "/api/health",
      },
    };
  }
}
