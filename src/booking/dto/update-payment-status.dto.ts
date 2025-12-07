import { IsEnum, IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentStatusDto {
  @ApiProperty({ 
    enum: ['paid', 'partial', 'incomplete', 'cancel'],
    description: 'Payment status to update',
    example: 'paid'
  })
  @IsEnum(['paid', 'partial', 'incomplete', 'cancel'])
  paymentStatus: 'paid' | 'partial' | 'incomplete' | 'cancel';

  @ApiPropertyOptional({ 
    description: 'Paid amount (required for partial payments)',
    example: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional({ 
    description: 'Remaining amount (required for partial payments)',
    example: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingAmount?: number;

  @ApiPropertyOptional({ 
    description: 'Notes about the payment',
    example: 'Partial payment received'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}