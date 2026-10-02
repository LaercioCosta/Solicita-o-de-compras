import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PerfilUsuario, SetorSlug } from '../generated/prisma/enums.js';
import type { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto.js';
import type { CriarUsuarioDto } from './dto/criar-usuario.dto.js';

export interface UsuarioResposta {
  id: number;
  nome: string;
  email: string;
  perfilId: number;
  setorId: number;
  createdAt: Date;
  updatedAt: Date;
  perfil: { id: number; slug: PerfilUsuario; nome: string };
  setor: { id: number; slug: SetorSlug; nome: string };
}

const selecaoUsuario = {
  id: true,
  nome: true,
  email: true,
  perfilId: true,
  setorId: true,
  createdAt: true,
  updatedAt: true,
  perfil: { select: { id: true, slug: true, nome: true } },
  setor: { select: { id: true, slug: true, nome: true } },
};

@Injectable()
export class AdminUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(
    usuario: UsuarioAutenticado,
    dto: CriarUsuarioDto,
  ): Promise<UsuarioResposta> {
    const perfil = await this.prisma.perfil.findUnique({
      where: { slug: dto.perfil },
    });
    if (!perfil) {
      throw new BadRequestException('Perfil inválido');
    }

    const setor = await this.prisma.setor.findUnique({
      where: { slug: dto.setor },
    });
    if (!setor) {
      throw new BadRequestException('Setor inválido');
    }

    const senhaHash = await hash(dto.senha);

    try {
      const criado = await this.prisma.usuario.create({
        data: {
          nome: dto.nome,
          email: dto.email,
          senhaHash,
          perfilId: perfil.id,
          setorId: setor.id,
        },
        select: selecaoUsuario,
      });

      await this.auditoria.registrar({
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        acao: 'CRIAR',
        entidade: 'usuario',
        entidadeId: criado.id,
      });

      return criado;
    } catch (erro) {
      this.lancarConflito(erro, 'E-mail já cadastrado');
    }
  }

  async listar(): Promise<UsuarioResposta[]> {
    return this.prisma.usuario.findMany({
      select: selecaoUsuario,
      orderBy: { id: 'asc' },
    });
  }

  async buscarPorId(id: number): Promise<UsuarioResposta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: selecaoUsuario,
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return usuario;
  }

  async atualizar(
    usuario: UsuarioAutenticado,
    id: number,
    dto: AtualizarUsuarioDto,
  ): Promise<UsuarioResposta> {
    const atual = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!atual) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const dados: {
      nome?: string;
      email?: string;
      senhaHash?: string;
      perfilId?: number;
      setorId?: number;
    } = {};
    const camposAlterados: string[] = [];

    if (dto.nome !== undefined) {
      dados.nome = dto.nome;
      camposAlterados.push('nome');
    }
    if (dto.email !== undefined) {
      dados.email = dto.email;
      camposAlterados.push('email');
    }
    if (dto.senha !== undefined) {
      dados.senhaHash = await hash(dto.senha);
      camposAlterados.push('senha');
    }
    if (dto.perfil !== undefined) {
      const perfil = await this.prisma.perfil.findUnique({
        where: { slug: dto.perfil },
      });
      if (!perfil) {
        throw new BadRequestException('Perfil inválido');
      }
      dados.perfilId = perfil.id;
      camposAlterados.push('perfil');
    }
    if (dto.setor !== undefined) {
      const setor = await this.prisma.setor.findUnique({
        where: { slug: dto.setor },
      });
      if (!setor) {
        throw new BadRequestException('Setor inválido');
      }
      dados.setorId = setor.id;
      camposAlterados.push('setor');
    }

    try {
      const atualizado = await this.prisma.usuario.update({
        where: { id },
        data: dados,
        select: selecaoUsuario,
      });

      await this.auditoria.registrar({
        usuarioId: usuario.id,
        perfil: usuario.perfil,
        acao: 'CORRIGIR',
        entidade: 'usuario',
        entidadeId: id,
        dados: { camposAlterados },
      });

      return atualizado;
    } catch (erro) {
      this.lancarConflito(erro, 'E-mail já cadastrado');
    }
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
