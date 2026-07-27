import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateProveedorDto {
  @IsString()
  nombre: string;

  @IsString()
  rubro: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  nota?: string;
}
