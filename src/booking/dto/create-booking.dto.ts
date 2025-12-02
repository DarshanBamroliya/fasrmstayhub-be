import { IsInt, IsString, IsEnum, IsDateString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'Farmhouse ID', example: 1 })
  @IsInt()
  farmhouseId: number;

  @ApiPropertyOptional({ description: 'User ID (if logged in)', example: 1 })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Customer name (required if not logged in)', example: 'John Doe' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer mobile (required if user not exists - at least one of mobile/email)', example: '+1234567890' })
  @IsOptional()
  @IsString()
  customerMobile?: string;

  @ApiPropertyOptional({ description: 'Customer email (required if user not exists - at least one of mobile/email)', example: 'john@example.com' })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty({ description: 'Booking start date (check-in date)', example: '2024-12-25' })
  @IsDateString()
  bookingDate: string;

  @ApiPropertyOptional({ description: 'Booking end date (check-out date) - will be calculated automatically', example: '2024-12-26' })
  @IsOptional()
  @IsDateString()
  bookingEndDate?: string;

  @ApiProperty({ description: 'Booking time from (start time)', example: '10:00' })
  @IsString()
  bookingTimeFrom: string;

  @ApiPropertyOptional({ description: 'Booking time to (end time) - will be calculated automatically if not provided', example: '22:00' })
  @IsOptional()
  @IsString()
  bookingTimeTo?: string;

  @ApiProperty({ description: 'Number of persons', example: 5 })
  @IsInt()
  @Min(1)
  numberOfPersons: number;

  @ApiProperty({ 
    enum: ['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'],
    description: 'Booking type',
    example: 'REGULAR_12HR'
  })
  @IsEnum(['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'])
  bookingType: 'REGULAR_12HR' | 'REGULAR_24HR' | 'WEEKEND_12HR' | 'WEEKEND_24HR';

  @ApiProperty({ description: 'Original price', example: 2000 })
  @IsNumber()
  @Min(0)
  originalPrice: number;

  @ApiPropertyOptional({ description: 'Discount amount (calculated automatically)', example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Final price after discount (calculated automatically)', example: 1900 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @ApiPropertyOptional({ description: 'Whether user is logged in', default: false })
  @IsOptional()
  @IsBoolean()
  isLoggedIn?: boolean;

  @ApiPropertyOptional({ 
    enum: ['paid', 'partial', 'incomplete', 'cancel'],
    default: 'incomplete',
    description: 'Payment status'
  })
  @IsOptional()
  @IsEnum(['paid', 'partial', 'incomplete', 'cancel'])
  paymentStatus?: 'paid' | 'partial' | 'incomplete' | 'cancel';

  @ApiPropertyOptional({ 
    enum: ['available', 'unavailable'],
    default: 'available',
    description: 'Farm status'
  })
  @IsOptional()
  @IsEnum(['available', 'unavailable'])
  farmStatus?: 'available' | 'unavailable';

  @ApiPropertyOptional({ 
    description: 'Additional booking data for invoice', 
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  bookingData?: any;
}

