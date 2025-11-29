import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginGoogleDto {
  @ApiProperty({ description: 'Firebase Google ID Token' })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
