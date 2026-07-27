import { IsString } from 'class-validator';

export class VenderPorTercerosDto {
  @IsString()
  detalle: string;
}
