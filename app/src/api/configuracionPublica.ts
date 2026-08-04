import { api } from './client';

export interface ContactoInfoPublica {
  whatsapp: string;
  telefono: string;
  email: string;
  instagramUrl: string;
  direccion: string;
  matricula: string;
  fotoNosotrosUrl: string | null;
}

export function fetchContactoInfo() {
  return api.get<ContactoInfoPublica>('/public/contacto-info');
}
