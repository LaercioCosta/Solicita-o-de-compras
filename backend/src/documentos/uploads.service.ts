import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {} from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ArquivoUpload = Express.Multer.File;

const extensoesMime: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

const tamanhoMaximoBytes = 10 * 1024 * 1024;

const pastaUploads = fileURLToPath(new URL('../../uploads/', import.meta.url));

// Hardening (Fase 8, DEC-026 item 8): o conteúdo precisa carregar a assinatura
// (magic bytes) do tipo declarado — extensão + MIME forjados não passam.
function conteudoCorrespondeExtensao(
  conteudo: Buffer,
  extensao: string,
): boolean {
  switch (extensao) {
    case 'pdf':
      return conteudo.subarray(0, 5).equals(Buffer.from('%PDF-', 'ascii'));
    case 'png':
      return conteudo
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg':
    case 'jpeg':
      return conteudo
        .subarray(0, 3)
        .equals(Buffer.from([0xff, 0xd8, 0xff]));
    default:
      return false;
  }
}

export interface ArquivoArmazenado {
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  hash: string;
  nomeArmazenado: string;
}

@Injectable()
export class UploadsService {
  async armazenar(
    arquivo: ArquivoUpload | undefined,
  ): Promise<ArquivoArmazenado> {
    if (!arquivo || !arquivo.buffer || arquivo.size === 0) {
      throw new BadRequestException('Arquivo é obrigatório');
    }

    const nomeOriginal = arquivo.originalname ?? '';
    const extensao = nomeOriginal.includes('.')
      ? (nomeOriginal.split('.').pop() as string).toLowerCase()
      : '';
    const mimeEsperado = extensoesMime[extensao];

    if (!mimeEsperado) {
      throw new BadRequestException(
        'Extensão de arquivo não permitida — use pdf, png, jpg ou jpeg',
      );
    }

    if (arquivo.mimetype !== mimeEsperado) {
      throw new BadRequestException(
        'O tipo de conteúdo do arquivo não corresponde à extensão informada',
      );
    }

    if (!conteudoCorrespondeExtensao(arquivo.buffer, extensao)) {
      throw new BadRequestException(
        'O conteúdo do arquivo não corresponde ao tipo declarado',
      );
    }

    if (arquivo.size > tamanhoMaximoBytes) {
      throw new BadRequestException(
        'O arquivo excede o tamanho máximo de 10MB',
      );
    }

    const nomeArmazenado = `${randomUUID()}.${extensao}`;
    const hash = createHash('sha256').update(arquivo.buffer).digest('hex');

    await mkdir(pastaUploads, { recursive: true });
    await writeFile(join(pastaUploads, nomeArmazenado), arquivo.buffer);

    return {
      nomeOriginal,
      mimeType: arquivo.mimetype,
      tamanhoBytes: arquivo.size,
      hash,
      nomeArmazenado,
    };
  }

  async remover(nomeArmazenado: string): Promise<void> {
    await unlink(join(pastaUploads, nomeArmazenado)).catch(() => undefined);
  }

  async ler(nomeArmazenado: string): Promise<Buffer> {
    try {
      return await readFile(join(pastaUploads, nomeArmazenado));
    } catch {
      throw new NotFoundException('Documento não encontrado');
    }
  }
}
