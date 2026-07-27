import { IsDateString, IsNumber, Min } from 'class-validator';

export class RegistrarSenaDto {
  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsDateString()
  fecha: string;
}
