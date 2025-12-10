import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import { Location } from '../products/entities/location.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';
import { User } from '../users/entities/user.entity';
import { BookingCronService } from 'src/common/cron/booking-cron.service';

@Module({
  imports: [SequelizeModule.forFeature([Booking, Farmhouse, PriceOption, Location, FarmhouseImage, User])],
  controllers: [BookingController],
  providers: [BookingService, BookingCronService],
  exports: [BookingService, BookingCronService],
})
export class BookingModule {}

