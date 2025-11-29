import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Farmhouse } from './entities/farmhouse.entity';
import { Location } from './entities/location.entity';
import { PriceOption } from './entities/price-option.entity';
import { HouseRule } from './entities/house-rule.entity';
import { FarmhouseImage } from './entities/farmhouse-image.entity';
import { Amenity } from './entities/amenity.entity';
import { AmenityCategory } from './entities/amenity-category.entity';
import { FarmhouseAmenity } from './entities/farmhouse-amenity.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Farmhouse,
      Location,
      PriceOption,
      HouseRule,
      FarmhouseImage,
      Amenity,
      AmenityCategory,
      FarmhouseAmenity,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}

