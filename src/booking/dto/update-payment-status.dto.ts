import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePaymentStatusDto {
  @ApiProperty({ 
    enum: ['paid', 'partial', 'incomplete', 'cancel'],
    description: 'Payment status to update',
    example: 'paid'
  })
  @IsEnum(['paid', 'partial', 'incomplete', 'cancel'])
  paymentStatus: 'paid' | 'partial' | 'incomplete' | 'cancel';
}