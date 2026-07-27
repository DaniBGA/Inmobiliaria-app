import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePropietarioDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
