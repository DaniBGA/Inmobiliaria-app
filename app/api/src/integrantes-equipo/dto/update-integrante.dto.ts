import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateIntegranteDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
