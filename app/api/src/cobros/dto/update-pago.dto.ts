import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePagoDto } from './create-pago.dto';

// Sin `mes`: editarPago() no permite cambiar a qué mes corresponde un pago
// ya cargado (ver PagosService).
export class UpdatePagoDto extends PartialType(OmitType(CreatePagoDto, ['mes'] as const)) {}
