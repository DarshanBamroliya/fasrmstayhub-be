import { IsOptional, IsInt, IsEnum, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryBookingDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by farmhouse ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  farmhouseId?: number;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({
    enum: ['paid', 'partial', 'incomplete', 'cancel'],
    description: 'Filter by payment status'
  })
  @IsOptional()
  @IsEnum(['paid', 'partial', 'incomplete', 'cancel'])
  paymentStatus?: 'paid' | 'partial' | 'incomplete' | 'cancel';

  @ApiPropertyOptional({ description: 'Filter by booking date (from)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by booking date (to)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search by user name, email, or farmhouse name' })
  @IsOptional()
  @IsString()
  search?: string;
}

