import { Controller, Post, Body, Get, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { ApiResponse as CustomApiResponse } from 'src/common/responses/api-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Admin Register
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new admin' })
  @ApiResponse({ status: 201, description: 'Admin registered successfully.' })
  @ApiResponse({ status: 400, description: 'Admin with this email already exists.' })
  @ApiBody({ type: RegisterAdminDto })
  async registerAdmin(@Body() registerAdminDto: RegisterAdminDto): Promise<CustomApiResponse<any>> {
    return this.adminService.registerAdmin(registerAdminDto);
  }

  // Admin Login
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin login successful.' })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  @ApiBody({ type: LoginAdminDto })
  async loginAdmin(@Body() loginAdminDto: LoginAdminDto): Promise<CustomApiResponse<any>> {
    return this.adminService.loginAdmin(loginAdminDto);
  }

  // Get All Users (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('users')
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users fetched successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllUsers(): Promise<CustomApiResponse<any>> {
    return this.adminService.getAllUsers();
  }

  // Get Admin Profile (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get admin profile (Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin profile fetched successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() req): Promise<CustomApiResponse<any>> {
    const adminId = req.user.id;
    return this.adminService.getProfile(adminId);
  }

  // Bulk Delete Users (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete('users/bulk-delete')
  @ApiOperation({ summary: 'Bulk delete users (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users deleted successfully.' })
  @ApiResponse({ status: 400, description: 'No user IDs provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: BulkDeleteUsersDto })
  async bulkDeleteUsers(@Body() bulkDeleteDto: BulkDeleteUsersDto): Promise<CustomApiResponse<any>> {
    return this.adminService.bulkDeleteUsers(bulkDeleteDto);
  }
}
