import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpsertInquilinoDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // "Se encuentra al día" (checkbox de carga): true cuando el inquilino ya
  // alquilaba desde antes de entrar al sistema y pagaba por fuera — anula la
  // deuda de meses anteriores (PropiedadesService.upsertInquilino la
  // traduce al mes actual en `alDiaDesde`). No se manda en ediciones que no
  // tocan este checkbox (EditarInquilinoModal), así no pisa el valor previo.
  @IsOptional()
  @IsBoolean()
  alDia?: boolean;
}
