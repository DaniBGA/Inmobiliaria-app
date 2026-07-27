import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { EtapaInteresado } from '@prisma/client';

export class CreateInteresadoDto {
  @IsOptional()
  @IsEnum(EtapaInteresado)
  etapa?: EtapaInteresado;

  @IsOptional()
  @IsNumber()
  oferta?: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  nombreLibre?: string;
}
