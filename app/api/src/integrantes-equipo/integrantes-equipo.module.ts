import { Module } from '@nestjs/common';
import { IntegrantesEquipoService } from './integrantes-equipo.service';
import { IntegrantesEquipoController } from './integrantes-equipo.controller';

@Module({
  providers: [IntegrantesEquipoService],
  controllers: [IntegrantesEquipoController],
  exports: [IntegrantesEquipoService],
})
export class IntegrantesEquipoModule {}
