import { PartialType } from '@nestjs/mapped-types';
import { CreateInteresadoDto } from './create-interesado.dto';

export class UpdateInteresadoDto extends PartialType(CreateInteresadoDto) {}
