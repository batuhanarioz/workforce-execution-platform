import { BadRequestException, Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LocationScope } from "./decorators/location-scope.decorator";
import { Roles } from "./decorators/roles.decorator";
import { LocationGuard } from "./guards/location.guard";
import { RolesGuard } from "./guards/roles.guard";
import { AccessScope, UserRole } from "@wfp/shared";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() body: LoginDto, @Req() request: { headers?: Record<string, string> }) {
    const normalizedEmail = body.email?.trim().toLowerCase();
    const normalizedPassword = body.password?.trim();

    if (!normalizedEmail || !normalizedPassword) {
      void this.authService.recordLoginFailure(body.email, {
        source: String(request.headers?.["x-client-platform"] ?? "api"),
        requestId: String(request.headers?.["x-request-id"] ?? ""),
      }).catch(() => undefined);
      throw new BadRequestException("Email and password are required.");
    }

    return this.authService.login(body, {
      source: String(request.headers?.["x-client-platform"] ?? "api"),
      requestId: String(request.headers?.["x-request-id"] ?? ""),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: unknown) {
    return {
      success: true,
      data: user ?? null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("directory")
  directory() {
    return this.authService.getDirectory();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, LocationGuard)
  @Roles(UserRole.SITE_CHIEF, UserRole.PROJECT_MANAGER, UserRole.ADMIN)
  @LocationScope(AccessScope.LOCATION)
  @Get("location-check/:locationId")
  locationCheck(@CurrentUser() user: unknown) {
    return {
      success: true,
      data: {
        user,
        message: "Location access granted.",
      },
    };
  }
}
