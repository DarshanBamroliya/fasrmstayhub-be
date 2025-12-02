import { IsOptional, IsArray, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Hero section sliders - array of image filenames (use POST /settings/hero-sliders to upload new images)',
    type: [String],
    example: ['hero-slider-1234567890-image1.jpg', 'hero-slider-1234567891-image2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  heroSliders?: string[];

  @ApiPropertyOptional({
    description: 'App logo filename for light mode (use POST /settings/logo with mode=light to upload)',
    example: 'logo-light-1234567890-logo.png',
  })
  @IsOptional()
  @IsString()
  appLogoLight?: string;

  @ApiPropertyOptional({
    description: 'App logo filename for dark mode (use POST /settings/logo with mode=dark to upload)',
    example: 'logo-dark-1234567890-logo.png',
  })
  @IsOptional()
  @IsString()
  appLogoDark?: string;
}

