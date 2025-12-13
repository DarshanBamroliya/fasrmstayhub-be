import { 
  IsInt, IsString, IsEnum, IsDateString, IsOptional, 
  IsBoolean, IsNumber, Min 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum BookingTypeEnum {
  REGULAR_12HR = 'REGULAR_12HR',
  REGULAR_24HR = 'REGULAR_24HR',
  WEEKEND_12HR = 'WEEKEND_12HR',
  WEEKEND_24HR = 'WEEKEND_24HR'
}

export enum PaymentStatusEnum {
  PAID = 'paid',
  PARTIAL = 'partial',
  INCOMPLETE = 'incomplete',
  CANCEL = 'cancel',
}

export enum FarmStatusEnum {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

export class CreateBookingDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  farmhouseId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerMobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty()
  @IsDateString()
  bookingDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  bookingEndDate?: string;

  @ApiProperty()
  @IsString()
  bookingTimeFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingTimeTo?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numberOfPersons: number;

  @ApiProperty({ enum: BookingTypeEnum })
  @IsEnum(BookingTypeEnum)
  bookingType: BookingTypeEnum;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  originalPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLoggedIn?: boolean;

  @ApiPropertyOptional({ enum: PaymentStatusEnum })
  @IsOptional()
  @IsEnum(PaymentStatusEnum)
  paymentStatus?: PaymentStatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  remainingAmount?: number;

  @ApiPropertyOptional({ enum: FarmStatusEnum })
  @IsOptional()
  @IsEnum(FarmStatusEnum)
  farmStatus?: FarmStatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  bookingData?: any;
}
