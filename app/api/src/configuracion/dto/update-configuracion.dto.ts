import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateConfiguracionDto {
  @IsOptional()
  @IsNumber()
  honorariosDefaultPorcentaje?: number;

  @IsOptional()
  @IsNumber()
  comisionVentaPorcentaje?: number;

  @IsOptional()
  @IsNumber()
  ipc?: number;

  @IsOptional()
  @IsNumber()
  icl?: number;

  @IsOptional()
  @IsNumber()
  dolarReferencia?: number;

  @IsOptional()
  @IsString()
  empresaNombre?: string;

  @IsOptional()
  @IsString()
  empresaCuit?: string;

  @IsOptional()
  @IsString()
  empresaDireccion?: string;

  @IsOptional()
  @IsString()
  empresaContacto?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  diaVencimientoAlquiler?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasAnticipacionAumento?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasAnticipacionVencimiento?: number;

  @IsOptional()
  @IsNumber()
  saldoInicialCaja?: number;

  @IsOptional()
  @IsString()
  publicoWhatsapp?: string;

  @IsOptional()
  @IsString()
  publicoTelefono?: string;

  @IsOptional()
  @IsString()
  publicoEmail?: string;

  @IsOptional()
  @IsString()
  publicoInstagramUrl?: string;

  @IsOptional()
  @IsString()
  publicoDireccion?: string;

  @IsOptional()
  @IsString()
  publicoMatricula?: string;

  @IsOptional()
  @IsString()
  facturaWhatsappMensaje?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  diasMostrarDespuesVentaAlquiler?: number;

  // Plantillas de los 7 tipos de aviso — ver el comentario en
  // schema.prisma junto a estos mismos campos.
  @IsOptional()
  @IsString()
  avisoReclamoDeudaMensaje?: string;

  @IsOptional()
  @IsString()
  avisoAumentoMensaje?: string;

  @IsOptional()
  @IsString()
  avisoRenovacionMensaje?: string;

  @IsOptional()
  @IsString()
  avisoClienteSinContactarMensaje?: string;

  @IsOptional()
  @IsString()
  avisoRecordatorioMensaje?: string;

  @IsOptional()
  @IsString()
  avisoLiquidacionListaMensaje?: string;

  @IsOptional()
  @IsString()
  avisoPedidoPresupuestoMensaje?: string;
}
