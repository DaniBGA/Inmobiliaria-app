import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoCartel } from '@prisma/client';

export class UpdateCartelDto {
  @IsOptional()
  @IsString()
  tipoCartel?: string;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsDateString()
  fechaColocacion?: string;

  @IsOptional()
  @IsDateString()
  fechaRetiro?: string;

  @IsOptional()
  @IsEnum(EstadoCartel)
  estado?: EstadoCartel;
}
