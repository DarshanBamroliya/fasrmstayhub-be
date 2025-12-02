import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Farmhouse } from '../products/entities/farmhouse.entity';
import { Location } from '../products/entities/location.entity';
import { PriceOption } from '../products/entities/price-option.entity';
import { FarmhouseImage } from '../products/entities/farmhouse-image.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Farmhouse, Location, PriceOption, FarmhouseImage]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
