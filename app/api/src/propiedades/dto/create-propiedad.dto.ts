import { Type } from 'class-transformer';
import {
  IsArray,
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
  ServicioFacturable,
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
  @IsBoolean()
  honorariosAdministracion?: boolean;

  @IsOptional()
  @IsNumber()
  honorariosAdministracionPorcentaje?: number;

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
  dormitorios?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  banos?: number;

  @IsOptional()
  @IsBoolean()
  cochera?: boolean;

  @IsOptional()
  @IsNumber()
  superficieM2?: number;

  @IsOptional()
  @IsNumber()
  superficieCubierta?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Qué ítems de servicios se ofrecen al emitir la factura del mes (ver
  // enum ServicioFacturable en el schema).
  @IsOptional()
  @IsArray()
  @IsEnum(ServicioFacturable, { each: true })
  serviciosHabilitados?: ServicioFacturable[];

  // Datos fijos de cuenta de algunos servicios trasladables (ver comentario
  // en schema.prisma) — se reflejan automáticamente en la factura.
  @IsOptional()
  @IsString()
  obrasSanitariasUsuario?: string;

  @IsOptional()
  @IsString()
  obrasSanitariasNumeroCuenta?: string;

  @IsOptional()
  @IsString()
  camuzziNumeroCuenta?: string;

  @IsOptional()
  @IsString()
  retributivasNumeroCuenta?: string;

  @IsOptional()
  @IsString()
  usinaNumeroCuenta?: string;

  // Publicación en la landing (solo aplica a ALQUILER vacante — ver
  // PublicPropiedadesService). Default true en el schema.
  @IsOptional()
  @IsBoolean()
  alquilerPublicado?: boolean;

  // Marca curada a mano para el carrusel destacado del Hero de la landing.
  @IsOptional()
  @IsBoolean()
  caracterEspecial?: boolean;
}
