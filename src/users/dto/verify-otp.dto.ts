import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, IsOptional } from 'class-validator';

export class VerifyOtpDto {
    @ApiProperty({ example: '9876543210', required: false, description: 'Optional - will be looked up from OTP if not provided' })
    @IsOptional()
    @IsString()
    @Length(10, 10)
    mobileNo?: string;

    @ApiProperty({ example: '112465' })
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    otp: string;
}
