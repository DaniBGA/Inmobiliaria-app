import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RolUsuario } from '@prisma/client';

export class CreateUsuarioDto {
  @IsString()
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;
}
