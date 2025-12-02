import { ApiProperty } from '@nestjs/swagger';

export class UserBookingDetailsDto {
  @ApiProperty()
  bookingId: number;

  @ApiProperty()
  farmName: string;

  @ApiProperty()
  farmLocation: string;

  @ApiProperty()
  bookingDate: Date;

  @ApiProperty()
  bookingEndDate: Date;

  @ApiProperty()
  bookingType: string;

  @ApiProperty()
  numberOfPersons: number;

  @ApiProperty()
  originalPrice: number;

  @ApiProperty()
  discountAmount: number;

  @ApiProperty()
  finalPrice: number;

  @ApiProperty()
  paymentStatus: string;

  @ApiProperty()
  createdAt: Date;
}

export class UserDetailsResponseDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  mobileNo: string;

  @ApiProperty()
  loginType: string;

  @ApiProperty()
  totalFarmBookings: number;

  @ApiProperty()
  totalPaymentReceived: number;

  @ApiProperty()
  totalPaymentPending: number;

  @ApiProperty()
  totalPaymentAmount: number;

  @ApiProperty({ type: [UserBookingDetailsDto] })
  bookings: UserBookingDetailsDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
