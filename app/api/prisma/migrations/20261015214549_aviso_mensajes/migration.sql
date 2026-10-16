-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "avisoAumentoMensaje" TEXT NOT NULL DEFAULT 'Hola {nombre}, te avisamos que el {fecha} corresponde actualizar el alquiler de {propiedad} (valor vigente actual: ${monto}). Te contactaremos con el nuevo monto.',
ADD COLUMN     "avisoClienteSinContactarMensaje" TEXT NOT NULL DEFAULT 'Hola {nombre}, te contactamos de la inmobiliaria respecto a tu búsqueda. ¿Seguís interesado/a?',
ADD COLUMN     "avisoLiquidacionListaMensaje" TEXT NOT NULL DEFAULT 'Hola {nombre}, tu liquidación de este mes ya está lista. Neto a girar: ${monto}.',
ADD COLUMN     "avisoPedidoPresupuestoMensaje" TEXT NOT NULL DEFAULT 'Solicitamos presupuesto para: "{titulo}" (rubro: {rubro}) en {propiedad}.',
ADD COLUMN     "avisoReclamoDeudaMensaje" TEXT NOT NULL DEFAULT 'Hola {nombre}, te escribimos de la inmobiliaria para recordarte que tenés una deuda acumulada de ${deuda} correspondiente a {mesesImpagos} mes(es). Por favor comunicate a la brevedad para regularizar la situación. Saludos.',
ADD COLUMN     "avisoRecordatorioMensaje" TEXT NOT NULL DEFAULT 'Recordatorio: {titulo} — {fecha}.',
ADD COLUMN     "avisoRenovacionMensaje" TEXT NOT NULL DEFAULT 'El contrato de {propiedad} vence el {fecha}. Coordinemos la renovación con {nombre}.';
