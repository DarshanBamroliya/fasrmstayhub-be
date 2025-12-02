import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { ApiResponse as CustomApiResponse } from 'src/common/responses/api-response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/user.decorator';
import { Role } from 'src/common/enums/role.enum';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Bookings')
@Controller('api/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  // All booking endpoints are documented below

  // Create Booking (Public - can be manual or logged in)
  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new booking (Public - manual or logged in)' })
  @ApiResponse({ status: 201, description: 'Booking created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid booking data.' })
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Req() req?: any,
  ): Promise<CustomApiResponse<any>> {
    // Note: For logged in users, pass isLoggedIn: true and userId in the DTO
    // The service will handle discount calculation based on isLoggedIn flag
    return this.bookingService.create(createBookingDto, null);
  }

  // Get User Orders (if logged in)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my-orders')
  @ApiOperation({ summary: 'Get current user orders (User only)' })
  @ApiResponse({ status: 200, description: 'User orders fetched successfully.' })
  async getMyOrders(@Req() req: any): Promise<CustomApiResponse<any>> {
    const userId = req.user.id || req.user.userId;
    return this.bookingService.getUserOrders(userId);
  }

  // Get Available Farms for Date (Public)
  @Public()
  @Get('available-farms')
  @ApiOperation({ summary: 'Get available farms' })
  @ApiResponse({ status: 200, description: 'Available farms fetched successfully.' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'bookingType', required: false, type: String })
  async getAvailableFarms(
    @Query('date') date?: string,
    @Query('bookingType') bookingType?: string,
  ): Promise<CustomApiResponse<any>> {
    return this.bookingService.getAvailableFarms(date ?? '', bookingType);
  }



  // Get Farm Availability (Public)
  @Public()
  @Get('farm/:farmhouseId/totelbookings')
  @ApiOperation({ summary: 'Get farm availability (current and future dates)' })
  @ApiResponse({ status: 200, description: 'Farm availability fetched successfully.' })
  async getFarmAvailability(
    @Param('farmhouseId', ParseIntPipe) farmhouseId: number,
  ): Promise<CustomApiResponse<any>> {
    return this.bookingService.getFarmAvailability(farmhouseId);
  }

  // Get Invoice by Token (Public)
  @Public()
  @Get('invoice/:token')
  @ApiOperation({ summary: 'Get invoice by token (Public)' })
  @ApiResponse({ status: 200, description: 'Invoice fetched successfully.' })
  @ApiResponse({ status: 404, description: 'Invoice not found.' })
  async getInvoiceByToken(
    @Param('token') token: string,
  ): Promise<CustomApiResponse<any>> {
    return this.bookingService.getInvoiceByToken(token);
  }

  // Get All Bookings (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all bookings with filters (Admin only)' })
  @ApiResponse({ status: 200, description: 'Bookings fetched successfully.' })
  async findAll(@Query() queryDto: QueryBookingDto): Promise<CustomApiResponse<any>> {
    return this.bookingService.findAll(queryDto);
  }

  // Get Booking by ID (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('admin/:id')
  @ApiOperation({ summary: 'Get booking by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Booking fetched successfully.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CustomApiResponse<any>> {
    return this.bookingService.findById(id);
  }

  // Get Farm Statistics (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('farm/:farmhouseId/statistics')
  @ApiOperation({ summary: 'Get farm booking statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Farm statistics fetched successfully.' })
  async getFarmStatistics(
    @Param('farmhouseId', ParseIntPipe) farmhouseId: number,
  ): Promise<CustomApiResponse<any>> {
    return this.bookingService.getFarmStatistics(farmhouseId);
  }

  // Update Booking (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch('admin/:id')
  @ApiOperation({ summary: 'Update booking (Admin only)' })
  @ApiResponse({ status: 200, description: 'Booking updated successfully.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookingDto: UpdateBookingDto,
  ): Promise<CustomApiResponse<any>> {
    return this.bookingService.update(id, updateBookingDto);
  }

  // Delete Booking (Admin only)
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete('admin/:id')
  @ApiOperation({ summary: 'Delete booking (Admin only)' })
  @ApiResponse({ status: 200, description: 'Booking deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<CustomApiResponse<any>> {
    return this.bookingService.remove(id);
  }
}

