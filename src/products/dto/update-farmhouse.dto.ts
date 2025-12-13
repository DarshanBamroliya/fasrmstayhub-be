import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------
// 🔹 Update Location DTO
// ---------------------------
export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Nearby landmark/area name', example: 'Adajan' })
  @IsOptional()
  @IsString()
  nearby?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

// ---------------------------
// 🔹 Update Price Option DTO
// ---------------------------
export class UpdatePriceOptionDto {
  @ApiPropertyOptional({
    enum: ['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'],
  })
  @IsOptional()
  @IsEnum(['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'])
  category?: 'REGULAR_12HR' | 'REGULAR_24HR' | 'WEEKEND_12HR' | 'WEEKEND_24HR';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPeople?: number;
}

// ---------------------------
// 🔹 Main Update Farmhouse DTO
// ---------------------------
export class UpdateFarmhouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    enum: ['HIGH', 'MEDIUM', 'LOW'],
  })
  @IsOptional()
  @IsEnum(['HIGH', 'MEDIUM', 'LOW'])
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPersons?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checkInFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checkOutTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecomanded?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAmazing?: boolean;

  @ApiPropertyOptional({ type: UpdateLocationDto })
  @IsOptional()
  location?: UpdateLocationDto;

  @ApiPropertyOptional({ type: [UpdatePriceOptionDto] })
  @IsOptional()
  priceOptions?: UpdatePriceOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  farmNo?: string;
}
