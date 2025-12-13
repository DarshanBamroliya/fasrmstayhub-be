import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location } from '../products/entities/location.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';
import { PriceOption } from '../products/entities/price-option.entity';

@Module({
    imports: [SequelizeModule.forFeature([Location, Farmhouse, FarmhouseImage, PriceOption])],
    controllers: [LocationsController],
    providers: [LocationsService],
    exports: [LocationsService],
})
export class LocationsModule { }
