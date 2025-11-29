import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAdminDto {
    @ApiProperty({ example: 'admin@farmstayhub.com', description: 'Admin Email' })
    @IsString()
    email: string;

    @ApiProperty({ example: 'AZsxdcfv@123', description: 'Admin Password' })
    @IsString()
    password: string;
}