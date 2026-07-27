import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEventoDto } from './create-evento.dto';

export class UpdateEventoDto extends PartialType(CreateEventoDto) {
  @IsOptional()
  @IsBoolean()
  hecho?: boolean;
}
