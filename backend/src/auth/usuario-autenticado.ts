import type { PerfilUsuario } from '../generated/prisma/enums.js';

export interface UsuarioAutenticado {
  id: number;
  email: string;
  perfil: PerfilUsuario;
  setorId: number;
}
