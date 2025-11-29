import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): SequelizeModuleOptions => ({
        dialect: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT') || 3306,
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        models: [User],
        autoLoadModels: true,
        // Note: Sequelize doesn't have 'synchronize' option like TypeORM
        // Use sync() method or migrations instead
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(@InjectConnection() private sequelize: Sequelize) {}

  async onModuleInit() {
    // Sync database schema on startup (alter: true adds missing columns without dropping data)
    try {
      await this.sequelize.sync({ alter: true });
      console.log('✅ Database schema synchronized');
    } catch (error) {
      console.error('❌ Database sync failed:', error);
      // Don't throw - allow app to start even if sync fails
    }
  }
}
