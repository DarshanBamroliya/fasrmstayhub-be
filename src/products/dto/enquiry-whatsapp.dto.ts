import { IsOptional, IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class EnquiryWhatsappDto {
  @ApiPropertyOptional({ description: 'Farmhouse ID to lookup owner phone' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  farmhouseId?: number;

  @ApiPropertyOptional({ description: 'Phone number if you want to provide directly' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Message for WhatsApp', example: 'Hello, I want to book...' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
