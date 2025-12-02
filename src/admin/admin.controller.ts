import { Controller, Post, Body, Get, Delete, UseGuards, Req, Put, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { ApiResponse as CustomApiResponse } from 'src/common/responses/api-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/common/decorators/public.decorator';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

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
  @ApiOperation({ summary: 'Get all users with pagination, search & filter (Admin only)' })
  @ApiResponse({ status: 200, description: 'Users fetched successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'loginType', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, enum: ['asc', 'desc'], description: 'Sort by created date' })
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('loginType') loginType?: string,
    @Query('sort') sort?: 'asc' | 'desc',
  ): Promise<CustomApiResponse<any>> {
    return this.adminService.getAllUsers({ page, limit, search, loginType, sort });
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

  // Update Admin Profile (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Put('update-profile')
  @ApiOperation({ summary: 'Update admin profile (Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin profile updated successfully.' })
  @ApiBody({ type: UpdateAdminDto })
  async updateProfile(
    @Req() req,
    @Body() updateAdminDto: UpdateAdminDto,
  ): Promise<CustomApiResponse<any>> {
    const adminId = req.user.id;
    return this.adminService.updateProfile(adminId, updateAdminDto);
  }

  // Get User Details by ID (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('user/:id')
  @ApiOperation({ summary: 'Get comprehensive user details by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User details fetched successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserDetails(@Param('id', ParseIntPipe) userId: number): Promise<CustomApiResponse<any>> {
    return this.adminService.getUserDetails(userId);
  }
}
