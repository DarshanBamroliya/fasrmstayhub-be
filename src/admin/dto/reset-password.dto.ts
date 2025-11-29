// reset-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ description: 'The reset token received from the user', type: String, example: 'resetToken123' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ description: 'The new password for the user', type: String, example: 'Admin@123' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @MaxLength(20, { message: 'Password must be at most 20 characters long' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,20}$/, {
        message: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    password?: string;

    // @ApiProperty({ description: 'The new password for the user', type: String, example: 'newPassword123' })
    // @IsString()
    // @IsNotEmpty()
    // @MinLength(6)
    // password: string;
}
