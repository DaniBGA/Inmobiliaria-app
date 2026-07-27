import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePropiedadDto } from './create-propiedad.dto';

export class UpdatePropiedadDto extends PartialType(
  OmitType(CreatePropiedadDto, ['montoAlquilerInicial', 'fechaAlquilerInicial'] as const),
) {}
