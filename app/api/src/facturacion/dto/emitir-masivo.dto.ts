import { Matches } from 'class-validator';

export class EmitirMasivoDto {
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;
}
