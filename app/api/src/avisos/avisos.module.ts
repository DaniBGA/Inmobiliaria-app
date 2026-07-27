import { Module } from '@nestjs/common';
import { AvisosService } from './avisos.service';
import { AvisosController } from './avisos.controller';
import { CobrosModule } from '../cobros/cobros.module';
import { IncidenciasModule } from '../incidencias/incidencias.module';
import { PropiedadesModule } from '../propiedades/propiedades.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [CobrosModule, IncidenciasModule, PropiedadesModule, ConfiguracionModule],
  providers: [AvisosService],
  controllers: [AvisosController],
  exports: [AvisosService],
})
export class AvisosModule {}
