import { IsString, IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddAmenityDto {
  @ApiProperty({ 
    description: 'Amenity name',
    example: 'Garden'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Quantity of the amenity',
    example: 1,
    default: 1
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ 
    description: 'Category name (optional, defaults to Common)',
    example: 'Common',
    required: false
  })
  @IsString()
  category?: string;
}

