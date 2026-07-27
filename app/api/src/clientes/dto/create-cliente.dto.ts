import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { EstadoCliente, TipoOperacionCliente, TipoPropiedad, ZonaCliente } from '@prisma/client';

export class CreateClienteDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(TipoOperacionCliente)
  tipoOperacion: TipoOperacionCliente;

  @IsOptional()
  @IsEnum(TipoPropiedad)
  busquedaTipoPropiedad?: TipoPropiedad;

  @IsOptional()
  @IsNumber()
  montoDesde?: number;

  @IsOptional()
  @IsNumber()
  montoHasta?: number;

  @IsOptional()
  @IsEnum(ZonaCliente)
  zona?: ZonaCliente;

  @IsOptional()
  @IsString()
  detalle?: string;

  @IsOptional()
  @IsEnum(EstadoCliente)
  estado?: EstadoCliente;

  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  @IsString()
  visitaOtraInmobiliariaConQuien?: string;

  @IsOptional()
  @IsString()
  delegadoId?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
