import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateCartelDto } from './create-cartel.dto';

// Sin `propiedadId` (no se reasigna un cartel a otra propiedad). Suma
// `fechaRetiro`, que no existe en el alta (un cartel recién colocado
// todavía no tiene fecha de retiro).
export class UpdateCartelDto extends PartialType(OmitType(CreateCartelDto, ['propiedadId'] as const)) {
  @IsOptional()
  @IsDateString()
  fechaRetiro?: string;
}
