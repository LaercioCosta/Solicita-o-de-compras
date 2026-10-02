import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { setoresAcumuloGf } from '../aprovacoes/aprovadores.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Solicitacao } from '../generated/prisma/client.js';
import type { EstadoSolicitacao, SetorSlug } from '../generated/prisma/enums.js';

type SolicitacaoPendente = Solicitacao & { setor: { slug: SetorSlug } };

function lerEnvInteiro(nome: string, padrao: number): number {
  const valor = Number.parseInt(process.env[nome] ?? '', 10);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

function minutosVerificacao(): number {
  return lerEnvInteiro('SLA_VERIFICACAO_MIN', 60);
}

function diasLembrete(): number {
  return lerEnvInteiro('SLA_LEMBRANTE_DIAS', 3);
}

function mensagemLembrete(
  idSolicitacao: number,
  status: EstadoSolicitacao,
  cicloAprovacao: number,
): string {
  const nivel =
    status === 'AGUARDANDO_APROVACAO_SETOR' ? 'setor' : 'financeira';
  // O ciclo integra a mensagem — o dedupe (mensagem, solicitacaoId) não pode
  // suprimir o lembrete do novo aprovador pendente após reabertura (DEC-020,
  // revisão Fase 10 achado #6).
  return `Lembrete: solicitação #${idSolicitacao} aguardando sua aprovação (${nivel}, ciclo ${cicloAprovacao})`;
}

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  @Interval(minutosVerificacao() * 60_000)
  verificarPeriodicamente(): void {
    if (process.env.SLA_ATIVO !== 'true') {
      return;
    }

    void this.verificarPendentes();
  }

  async verificarPendentes(): Promise<number> {
    const limite = new Date(Date.now() - diasLembrete() * 24 * 60 * 60 * 1000);

    const pendentes = await this.prisma.solicitacao.findMany({
      where: {
        status: {
          in: ['AGUARDANDO_APROVACAO_SETOR', 'AGUARDANDO_APROVACAO_FINANCEIRA'],
        },
        updatedAt: { lt: limite },
      },
      include: { setor: { select: { slug: true } } },
    });

    let notificacoesCriadas = 0;

    for (const solicitacao of pendentes) {
      notificacoesCriadas += await this.criarLembreteSePendente(solicitacao);
    }

    return notificacoesCriadas;
  }

  private async criarLembreteSePendente(
    solicitacao: SolicitacaoPendente,
  ): Promise<number> {
    const mensagem = mensagemLembrete(solicitacao.id, solicitacao.status, solicitacao.cicloAprovacao);

    const existente = await this.prisma.notificacao.findFirst({
      where: { mensagem, solicitacaoId: solicitacao.id },
      select: { id: true },
    });

    if (existente) {
      return 0;
    }

    const destinatarios = await this.destinatarios(solicitacao);

    if (destinatarios.length === 0) {
      return 0;
    }

    await this.prisma.notificacao.createMany({
      data: destinatarios.map((usuarioId) => ({
        usuarioId,
        mensagem,
        solicitacaoId: solicitacao.id,
      })),
    });

    return destinatarios.length;
  }

  private async destinatarios(
    solicitacao: SolicitacaoPendente,
  ): Promise<number[]> {
    const aprovaNivelFinanceira =
      solicitacao.status === 'AGUARDANDO_APROVACAO_FINANCEIRA' ||
      setoresAcumuloGf.includes(solicitacao.setor.slug);

    if (!aprovaNivelFinanceira) {
      const gerentes = await this.prisma.usuario.findMany({
        where: {
          perfil: { slug: 'GERENTE' },
          setorId: solicitacao.setorId,
        },
        select: { id: true },
      });

      return gerentes.map((gerente) => gerente.id);
    }

    const gerentesFinanceiros = await this.prisma.usuario.findMany({
      where: { perfil: { slug: 'GERENTE_FINANCEIRA' } },
      select: { id: true },
    });

    return gerentesFinanceiros.map((gerente) => gerente.id);
  }
}
