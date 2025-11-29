import { IsString, IsInt, IsEnum, IsOptional, IsBoolean, IsTimeZone, IsNotEmpty, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ description: 'Full address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State name' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  longitude?: number;
}

export class CreatePriceOptionDto {
  @ApiProperty({ 
    enum: ['REGULAR', 'WEEKEND', 'COUPLE'], 
    description: 'Price category',
    example: 'REGULAR'
  })
  @IsEnum(['REGULAR', 'WEEKEND', 'COUPLE'])
  category: 'REGULAR' | 'WEEKEND' | 'COUPLE';

  @ApiProperty({ 
    description: 'Number of hours',
    example: 12
  })
  @IsInt()
  @Min(1)
  hours: number;

  @ApiProperty({ 
    description: 'Price amount',
    example: 1200
  })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ 
    description: 'Maximum people allowed',
    example: 10
  })
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
  @IsInt()
  @Min(1)
  maxPersons: number;

  @ApiProperty({ description: 'Number of bedrooms' })
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
    description: 'Price options (can add REGULAR and WEEKEND separately)',
    example: [
      { category: 'REGULAR', hours: 12, price: 1200, maxPeople: 10 },
      { category: 'WEEKEND', hours: 12, price: 1500, maxPeople: 10 }
    ]
  })
  @IsOptional()
  priceOptions?: CreatePriceOptionDto[];

  @ApiPropertyOptional({ type: [CreateHouseRuleDto], description: 'House rules' })
  @IsOptional()
  houseRules?: CreateHouseRuleDto[];
}

