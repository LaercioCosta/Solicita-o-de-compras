import { INestApplication, ValidationPipe } from '@nestjs/common';
import { configurarDocumentacaoOpenapi } from './openapi.js';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  configurarDocumentacaoOpenapi(app);
}
