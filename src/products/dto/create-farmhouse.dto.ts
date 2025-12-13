import { IsString, IsInt, IsEnum, IsOptional, IsBoolean, IsTimeZone, IsNotEmpty, Min, Max, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateLocationDto } from '../../locations/dto/create-location.dto';

export class CreatePriceOptionDto {
  @ApiProperty({ 
    enum: ['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'], 
    description: 'Price category',
    example: 'REGULAR_12HR'
  })
  @IsEnum(['REGULAR_12HR', 'REGULAR_24HR', 'WEEKEND_12HR', 'WEEKEND_24HR'])
  category: 'REGULAR_12HR' | 'REGULAR_24HR' | 'WEEKEND_12HR' | 'WEEKEND_24HR';

  @ApiProperty({ 
    description: 'Price amount',
    example: 1200
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ 
    description: 'Maximum people allowed',
    example: 10
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPeople: number;
}

export class CreateHouseRuleDto {
  @ApiProperty({ description: 'Rule text' })
  @IsString()
  @IsNotEmpty()
  rule: string;
}

export class CreateFarmhouseDto {
  @ApiProperty({ description: 'Farmhouse name', example: 'Awesome 11' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'URL friendly slug', example: 'awesome-11' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(['HIGH', 'MEDIUM', 'LOW'])
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';

  @ApiProperty({ description: 'Maximum persons capacity' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPersons: number;

  @ApiProperty({ description: 'Number of bedrooms' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bedrooms: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Check-in time', example: '10:00' })
  @IsString()
  @IsNotEmpty()
  checkInFrom: string;

  @ApiProperty({ description: 'Check-out time', example: '09:00' })
  @IsString()
  @IsNotEmpty()
  checkOutTo: string;

  @ApiPropertyOptional({ description: 'Status', default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ description: 'Is recommended', default: false })
  @IsOptional()
  @IsBoolean()
  isRecomanded?: boolean;

  @ApiPropertyOptional({ description: 'Is amazing view', default: false })
  @IsOptional()
  @IsBoolean()
  isAmazing?: boolean;

  @ApiPropertyOptional({ type: CreateLocationDto, description: 'Location details' })
  @IsOptional()
  location?: CreateLocationDto;

  @ApiPropertyOptional({ 
    type: [CreatePriceOptionDto], 
    description: 'Price options (12hr regular, 24hr regular, 12hr weekend, 24hr weekend)',
    example: [
      { category: 'REGULAR_12HR', price: 1200, maxPeople: 10 },
      { category: 'REGULAR_24HR', price: 2000, maxPeople: 10 },
      { category: 'WEEKEND_12HR', price: 1500, maxPeople: 10 },
      { category: 'WEEKEND_24HR', price: 2500, maxPeople: 10 }
    ]
  })
  @IsOptional()
  priceOptions?: CreatePriceOptionDto[];

  @ApiPropertyOptional({ description: 'Farm number (for multiple farms in one society)', example: 'Farm-1' })
  @IsOptional()
  @IsString()
  farmNo?: string;
}

