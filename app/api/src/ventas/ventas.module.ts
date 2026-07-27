import { Module } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { VentasController } from './ventas.controller';
import { CajaModule } from '../caja/caja.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [CajaModule, ConfiguracionModule],
  providers: [VentasService],
  controllers: [VentasController],
  exports: [VentasService],
})
export class VentasModule {}
