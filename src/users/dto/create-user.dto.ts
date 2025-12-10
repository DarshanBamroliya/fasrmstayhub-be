import { IsEmail, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Mobile number' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiProperty({ description: 'Name of the user' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
