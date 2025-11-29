import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StaticPageService } from './Staticpage.service';
import { StaticPageController } from './Staticpage.controller';
import { StaticPage } from './entities/Staticpage.model';

@Module({
  imports: [SequelizeModule.forFeature([StaticPage])],
  providers: [StaticPageService],
  controllers: [StaticPageController],
})
export class StaticPageModule {}
