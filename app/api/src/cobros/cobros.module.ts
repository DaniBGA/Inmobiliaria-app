import { Module } from '@nestjs/common';
import { CobrosService } from './cobros.service';
import { CobrosController } from './cobros.controller';
import { PropiedadesModule } from '../propiedades/propiedades.module';
import { CajaModule } from '../caja/caja.module';
import { GastosModule } from '../gastos/gastos.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [PropiedadesModule, CajaModule, GastosModule, ConfiguracionModule],
  providers: [CobrosService],
  controllers: [CobrosController],
  exports: [CobrosService],
})
export class CobrosModule {}
