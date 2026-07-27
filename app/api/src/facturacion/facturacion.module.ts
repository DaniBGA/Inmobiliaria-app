import { Module } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { RecibosService } from './recibos.service';
import { FacturacionController } from './facturacion.controller';
import { PropiedadesModule } from '../propiedades/propiedades.module';
import { GastosModule } from '../gastos/gastos.module';
import { CobrosModule } from '../cobros/cobros.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [PropiedadesModule, GastosModule, CobrosModule, ConfiguracionModule],
  providers: [FacturasService, RecibosService],
  controllers: [FacturacionController],
  exports: [FacturasService, RecibosService],
})
export class FacturacionModule {}
