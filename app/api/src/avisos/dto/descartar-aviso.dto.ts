import { IsString } from 'class-validator';

export class DescartarAvisoDto {
  @IsString()
  grupo: string;

  @IsString()
  clave: string;
}
