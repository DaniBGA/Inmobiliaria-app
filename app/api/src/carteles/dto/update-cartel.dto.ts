import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoCartel } from '@prisma/client';

export class UpdateCartelDto {
  @IsOptional()
  @IsEnum(EstadoCartel)
  tipoCartel?: EstadoCartel;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsDateString()
  fechaColocacion?: string;

  @IsOptional()
  @IsDateString()
  fechaRetiro?: string;
}
