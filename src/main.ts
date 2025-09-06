import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5000'], // Add your frontend URLs
    credentials: true,
  });

  // Add global prefix "api"
  app.setGlobalPrefix('api');

  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Get port from environment or use default
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
}
bootstrap();
