import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoOperacionCliente } from '@prisma/client';

// Simplificado a las 3 operaciones que existen en TipoOperacionCliente —
// el formulario de la landing no ofrece "Invertir"/"Tasar" (el enum no las
// soporta, no vale la pena ampliarlo por dos opciones sin otro uso).
export class CreateContactoDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(TipoOperacionCliente)
  tipoOperacion: TipoOperacionCliente;

  @IsOptional()
  @IsString()
  mensaje?: string;
}
