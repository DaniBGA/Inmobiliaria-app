import { Module } from '@nestjs/common';
import { LiquidacionesService } from './liquidaciones.service';
import { LiquidacionesController } from './liquidaciones.controller';
import { FacturacionModule } from '../facturacion/facturacion.module';
import { GastosModule } from '../gastos/gastos.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { CajaModule } from '../caja/caja.module';

@Module({
  imports: [FacturacionModule, GastosModule, ConfiguracionModule, CajaModule],
  providers: [LiquidacionesService],
  controllers: [LiquidacionesController],
  exports: [LiquidacionesService],
})
export class LiquidacionesModule {}
