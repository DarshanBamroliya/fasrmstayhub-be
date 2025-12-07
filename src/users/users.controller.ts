import { Controller, Post, Body, Get, Put, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { LoginGoogleDto } from './dto/login-google.dto';
import { LoginMobileDto } from './dto/login-mobile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private userService: UsersService) { }

  // Admin: create user with either email or mobile (requires admin role)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('create')
  @ApiOperation({ summary: 'Admin: create a new user (email or mobile required)' })
  async createUser(@Req() req, @Body() dto: CreateUserDto) {
    return this.userService.createUser(dto, req.user?.id);
  }

  @Public()
  @Post('google-login')
  async googleLogin(@Body() dto: LoginGoogleDto) {
    return this.userService.loginWithGoogle(dto);
  }

  @Public()
  @Post('mobile-login')
  async mobileLogin(@Body() dto: LoginMobileDto) {
    return this.userService.loginWithMobile(dto);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    // mobileNo is optional - can verify with just OTP
    return this.userService.verifyOtp(dto.otp, dto.mobileNo);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  async getProfile(@Req() req) {
    // Support both id and userId for compatibility
    const userId = req.user.id || req.user.userId;
    return this.userService.myProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('save-farm')
  async saveFarm(@Req() req, @Body() body: { productId: number }) {
    const userId = req.user.id || req.user.userId;
    return this.userService.saveFarm(userId, body.productId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('saved-farms')
  async getSavedFarms(@Req() req) {
    const userId = req.user.id || req.user.userId;
    return this.userService.getSavedFarms(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('booked-farms')
  @ApiOperation({ summary: 'Get booked farms for current user' })
  @ApiResponse({ status: 200, description: 'Booked farms fetched successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBookedFarms(@Req() req) {
    const userId = req.user.id || req.user.userId;
    return this.userService.getBookedFarms(userId);
  }
}
