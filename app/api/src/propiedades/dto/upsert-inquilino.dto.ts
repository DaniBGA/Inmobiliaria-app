import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpsertInquilinoDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
