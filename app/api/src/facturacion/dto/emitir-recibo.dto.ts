import { Matches } from 'class-validator';

export class EmitirReciboDto {
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;
}
