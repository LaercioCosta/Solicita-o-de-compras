import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { SetorSlug } from '../generated/prisma/enums.js';

export const setoresAcumuloGf: ReadonlyArray<SetorSlug> = ['OFICINA', 'TI'];

export function validarGerenteDoSetor(
  usuario: UsuarioAutenticado,
  setorId: number,
): void {
  if (usuario.perfil === 'GERENTE' && usuario.setorId !== setorId) {
    throw new NotFoundException('Solicitação não encontrada');
  }
}

export function validarAprovadorNivelSetor(
  usuario: UsuarioAutenticado,
  slugSetor: SetorSlug,
): void {
  if (usuario.perfil === 'GERENTE_FINANCEIRA') {
    if (setoresAcumuloGf.includes(slugSetor)) {
      return;
    }
    throw new NotFoundException('Solicitação não encontrada');
  }

  if (usuario.perfil === 'GERENTE') {
    // DEC-019: em Oficina e TI o 1º nível pertence à Gerente Financeira —
    // um GERENTE vinculado a esses setores não aprova (revisão Fase 10, achado #2).
    if (setoresAcumuloGf.includes(slugSetor)) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    return;
  }

  throw new ForbiddenException(
    'Você não é o aprovador responsável pelo nível atual desta solicitação',
  );
}
