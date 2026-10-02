import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Setor } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AtualizarSetorDto } from './dto/atualizar-setor.dto.js';
import type { CriarSetorDto } from './dto/criar-setor.dto.js';

@Injectable()
export class AdminSetoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(usuario: UsuarioAutenticado, dto: CriarSetorDto): Promise<Setor> {
    try {
      const criado = await this.prisma.setor.create({
        data: { slug: dto.slug, nome: dto.nome },
      });

      await this.auditoria.registrar({
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        acao: 'CRIAR',
        entidade: 'setor',
        entidadeId: criado.id,
      });

      return criado;
    } catch (erro) {
      this.lancarConflito(erro, 'Slug de setor já cadastrado');
    }
  }

  async listar(): Promise<Setor[]> {
    return this.prisma.setor.findMany({ orderBy: { id: 'asc' } });
  }

  async atualizar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: AtualizarSetorDto,
  ): Promise<Setor> {
    const atual = await this.prisma.setor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!atual) {
      throw new NotFoundException('Setor não encontrado');
    }

    const dados: { nome?: string } = {};
    const camposAlterados: string[] = [];

    if (dto.nome !== undefined) {
      dados.nome = dto.nome;
      camposAlterados.push('nome');
    }

    const atualizado = await this.prisma.setor.update({
      where: { id },
      data: dados,
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      perfil: usuario.perfil,
      acao: 'CORRIGIR',
      entidade: 'setor',
      entidadeId: id,
      dados: { camposAlterados },
    });

    return atualizado;
  }

  private lancarConflito(erro: unknown, mensagem: string): never {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === 'P2002'
    ) {
      throw new ConflictException(mensagem);
    }
    throw erro;
  }
}
