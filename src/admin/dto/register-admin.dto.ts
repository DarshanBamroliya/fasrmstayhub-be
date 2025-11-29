import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterAdminDto {
    @ApiProperty({ example: 'John', description: 'Admin First Name' })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'Admin Last Name' })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({ example: 'admin@farmstayhub.com', description: 'Admin Email' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'SecurePassword123!', description: 'Admin Password' })
    @IsString()
    @IsNotEmpty()
    password: string;
}

