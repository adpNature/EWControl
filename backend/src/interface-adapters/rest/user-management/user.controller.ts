import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { ChangePasswordUseCase } from '../../../use-cases/auth/change-password.use-case';
import { CurrentPasswordInvalidError } from '../../../use-cases/auth/errors/current-password-invalid.error';
import { CreateUserUseCase } from '../../../use-cases/user-management/create-user.use-case';
import { DeactivateUserUseCase } from '../../../use-cases/user-management/deactivate-user.use-case';
import { CannotCreateSuperAdminError } from '../../../use-cases/user-management/errors/cannot-create-superadmin.error';
import { CannotDeactivateSelfError } from '../../../use-cases/user-management/errors/cannot-deactivate-self.error';
import { CompanyIdRequiredError } from '../../../use-cases/user-management/errors/company-id-required.error';
import { EmailAlreadyExistsError } from '../../../use-cases/user-management/errors/email-already-exists.error';
import { UserNotFoundError } from '../../../use-cases/user-management/errors/user-not-found.error';
import { GetUserUseCase } from '../../../use-cases/user-management/get-user.use-case';
import { ListUsersUseCase } from '../../../use-cases/user-management/list-users.use-case';
import { UpdateUserUseCase } from '../../../use-cases/user-management/update-user.use-case';
import { ChangePasswordDto } from './change-password.dto';
import { CreateUserDto } from './create-user.dto';
import { ListUsersQueryDto } from './list-users-query.dto';
import { UpdateUserDto } from './update-user.dto';
import { toUserResponse, UserResponse } from './user-response.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

type ListUsersResponse = { data: UserResponse[]; total: number; limit: number; offset: number };

/**
 * docs/specs/10-gestion-companies-users.md, docs/11-api-rest.md sección "User".
 * Sin `@roles()`: tanto `AdminCliente` como `SuperAdmin` entran, el alcance lo
 * resuelve `UserAccessResolver`/cada use-case, no un gate de rol a nivel de clase.
 */
@Controller('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @currentUser() user: CurrentUser,
  ): Promise<UserResponse> {
    try {
      const created = await this.createUserUseCase.execute({
        requester: { companyId: user.companyId, role: user.role },
        companyId: dto.companyId,
        email: dto.email,
        password: dto.password,
        role: dto.role,
      });
      return toUserResponse(created);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get()
  async list(
    @Query() query: ListUsersQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<ListUsersResponse> {
    const result = await this.listUsersUseCase.execute({
      requester: { companyId: user.companyId, role: user.role },
      companyId: query.companyId,
      pagination: { limit: query.limit ?? DEFAULT_LIMIT, offset: query.offset ?? DEFAULT_OFFSET },
    });
    return { ...result, data: result.data.map(toUserResponse) };
  }

  @Get(':id')
  async get(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<UserResponse> {
    try {
      const found = await this.getUserUseCase.execute({
        userId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
      return toUserResponse(found);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @currentUser() user: CurrentUser,
  ): Promise<void> {
    try {
      await this.changePasswordUseCase.execute({
        userId: user.id,
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @currentUser() user: CurrentUser,
  ): Promise<UserResponse> {
    try {
      const updated = await this.updateUserUseCase.execute({
        userId: id,
        requester: { companyId: user.companyId, role: user.role },
        email: dto.email,
        role: dto.role,
      });
      return toUserResponse(updated);
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<void> {
    try {
      await this.deactivateUserUseCase.execute({
        userId: id,
        requesterId: user.id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof UserNotFoundError) {
      return new NotFoundException({ code: 'USER_NOT_FOUND', message: error.message });
    }
    if (error instanceof EmailAlreadyExistsError) {
      return new ConflictException({ code: 'EMAIL_ALREADY_EXISTS', message: error.message });
    }
    if (error instanceof CannotCreateSuperAdminError) {
      return new ForbiddenException({ code: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof CannotDeactivateSelfError) {
      return new UnprocessableEntityException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: error.message,
      });
    }
    if (error instanceof CompanyIdRequiredError) {
      return new UnprocessableEntityException({
        code: 'COMPANY_ID_REQUIRED',
        message: error.message,
      });
    }
    if (error instanceof CurrentPasswordInvalidError) {
      return new UnprocessableEntityException({
        code: 'CURRENT_PASSWORD_INVALID',
        message: error.message,
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
