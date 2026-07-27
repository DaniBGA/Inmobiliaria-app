import { IsDateString, IsNumber, Min } from 'class-validator';

export class RegistrarAumentoDto {
  @IsDateString()
  fecha: string;

  @IsNumber()
  @Min(0)
  monto: number;
}
