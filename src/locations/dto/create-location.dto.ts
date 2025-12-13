import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationApiDto {
    @ApiProperty({ description: 'Nearby landmark/area name', example: 'Adajan' })
    @IsOptional()
    @IsString()
    nearby?: string;

    @ApiProperty({ description: 'City name', example: 'sayan' })
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty({ description: 'State name', example: 'Gujarat' })
    @IsNotEmpty()
    @IsString()
    state: string;
}
