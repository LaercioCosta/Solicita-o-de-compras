import { NotFoundException } from '@nestjs/common';

export function paraIdParametro(valor: string, mensagem: string): number {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundException(mensagem);
  }

  return id;
}
