import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function versaoDoPacote(): string {
  const pacote = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return pacote.version;
}

export function configurarDocumentacaoOpenapi(app: INestApplication): void {
  // Superfície mínima (Fase 8, revisão Fase 10 achado #4): a UI do Swagger e o
  // JSON do OpenAPI não são expostos em produção — ficam disponíveis só em dev/CI.
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const configuracao = new DocumentBuilder()
    .setTitle('Sistema de Compras API')
    .setDescription(
      'API REST do Sistema de Compras — autenticação via JWT Bearer (Authorization: Bearer <token>).',
    )
    .setVersion(versaoDoPacote())
    .addBearerAuth()
    .build();

  const documento = SwaggerModule.createDocument(app, configuracao);
  SwaggerModule.setup('api/docs', app, documento);
}
