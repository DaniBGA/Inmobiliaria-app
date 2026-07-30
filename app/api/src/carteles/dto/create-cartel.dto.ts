import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoCartel } from '@prisma/client';

export class CreateCartelDto {
  @IsString()
  propiedadId: string;

  @IsOptional()
  @IsEnum(EstadoCartel)
  tipoCartel?: EstadoCartel;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsDateString()
  fechaColocacion?: string;
}
