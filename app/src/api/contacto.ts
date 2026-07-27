import { api } from './client';

export type TipoOperacionContacto = 'ALQUILAR' | 'COMPRAR' | 'VENDER';

export interface ContactoDto {
  nombre: string;
  telefono?: string;
  email?: string;
  tipoOperacion: TipoOperacionContacto;
  mensaje?: string;
}

export function enviarContacto(dto: ContactoDto) {
  return api.post<{ ok: true }>('/public/contacto', dto);
}
