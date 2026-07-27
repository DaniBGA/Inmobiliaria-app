import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  ModalidadPropiedad,
  TipoPropiedad,
  TipoHonorarios,
  IndiceAjuste,
  PunitorioFrecuencia,
  PunitorioTipo,
} from '@prisma/client';

export class CreatePropiedadDto {
  @IsString()
  nombre: string;

  @IsString()
  direccion: string;

  @IsEnum(ModalidadPropiedad)
  modalidad: ModalidadPropiedad;

  @IsEnum(TipoPropiedad)
  tipo: TipoPropiedad;

  @IsOptional()
  @IsString()
  propietarioId?: string;

  @IsOptional()
  @IsString()
  designadoId?: string;

  @IsOptional()
  @IsEnum(TipoHonorarios)
  honorariosTipo?: TipoHonorarios;

  @IsOptional()
  @IsNumber()
  honorariosPorcentaje?: number;

  @IsOptional()
  @IsEnum(IndiceAjuste)
  indice?: IndiceAjuste;

  @IsOptional()
  @IsInt()
  @Min(1)
  frecuenciaAumentoMeses?: number;

  @IsOptional()
  @IsDateString()
  contratoInicio?: string;

  @IsOptional()
  @IsDateString()
  contratoFin?: string;

  @IsOptional()
  @IsEnum(PunitorioFrecuencia)
  punitorioFrecuencia?: PunitorioFrecuencia;

  @IsOptional()
  @IsEnum(PunitorioTipo)
  punitorioTipo?: PunitorioTipo;

  @IsOptional()
  @IsNumber()
  punitorioValor?: number;

  // Carga inicial del alquiler vigente (§3.1, §5.1): se guarda como el
  // primer registro del historial de aumentos, no como un campo suelto.
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  montoAlquilerInicial?: number;

  @IsOptional()
  @IsDateString()
  fechaAlquilerInicial?: string;

  // Specs para la ficha pública (landing page) — opcionales.
  @IsOptional()
  @IsInt()
  @Min(0)
  ambientes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  banos?: number;

  @IsOptional()
  @IsNumber()
  superficieM2?: number;

  // Publicación en la landing (solo aplica a ALQUILER vacante — ver
  // PublicPropiedadesService). Default true en el schema.
  @IsOptional()
  @IsBoolean()
  alquilerPublicado?: boolean;
}
