import { IsDateString, IsIn, IsNumber, IsString, Matches, Min } from 'class-validator';
import { DestinoGasto } from '@prisma/client';

// Carga manual (ficha de propiedad, Liquidaciones): el destino INMOBILIARIA
// solo lo asigna el sistema al resolver una incidencia (§2.5, §3.2/§3.3), no
// está disponible en el alta manual de un gasto.
const DESTINOS_CARGA_MANUAL = [DestinoGasto.PROPIETARIO, DestinoGasto.INQUILINO] as const;

export class CreateGastoDto {
  @IsString()
  propiedadId: string;

  @Matches(/^\d{4}-\d{2}$/)
  mes: string;

  @IsString()
  descripcion: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsDateString()
  fecha: string;

  @IsString()
  categoria: string;

  @IsIn(DESTINOS_CARGA_MANUAL)
  destino: typeof DESTINOS_CARGA_MANUAL[number];
}
