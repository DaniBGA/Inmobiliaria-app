import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateCartelDto {
  @IsString()
  propiedadId: string;

  @IsString()
  tipoCartel: string;

  @IsOptional()
  @IsString()
  medida?: string;

  @IsOptional()
  @IsDateString()
  fechaColocacion?: string;
}
