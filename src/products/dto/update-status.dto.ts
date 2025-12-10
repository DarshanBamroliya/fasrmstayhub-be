import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFarmhouseStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  status: boolean;
}
