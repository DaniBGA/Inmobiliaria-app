import { PartialType } from '@nestjs/mapped-types';
import { RegistrarAumentoDto } from './registrar-aumento.dto';

export class UpdateAumentoDto extends PartialType(RegistrarAumentoDto) {}
