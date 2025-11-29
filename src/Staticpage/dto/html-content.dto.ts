// src/Staticpage/dto/update-html-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateHtmlContentDto {
  @ApiProperty({
    description: 'HTML content of the static page',
    example: '<p>These are the rules of the house...</p>',
  })
  @IsString()
  @IsNotEmpty()
  htmlContent: string;
}
