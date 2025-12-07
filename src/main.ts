import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });


  // ✅ Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,      // strip unknown properties
    forbidNonWhitelisted: true, // throw error on unknown props
    transform: true,      // auto-transform payloads to DTO classes
  }));

  // ✅ Global Response Interceptor (Success)
  app.useGlobalInterceptors(new TransformInterceptor());

  // ✅ Global Exception Filter (Error)
  app.useGlobalFilters(new HttpExceptionFilter());

  // ✅ Enable CORS
  app.enableCors();

  // ✅ Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Farmstayhub API')
    .setDescription('API documentation for Farmstayhub')
    .setVersion('1.0')
    .addBearerAuth() // for JWT protected routes
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 8000;
  await app.listen(port);

  Logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  Logger.log(`📄 Swagger UI available at: http://localhost:${port}/api`);
}
bootstrap();
