import 'dotenv/config';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

function criarConfiguracaoPrisma(): { adapter: PrismaMariaDb } {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida — verifique backend/.env');
  }

  return { adapter: new PrismaMariaDb(databaseUrl) };
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient(criarConfiguracaoPrisma());
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(criarConfiguracaoPrisma());
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
