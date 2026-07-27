import { Module } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { AgendaController } from './agenda.controller';
import { PropiedadesModule } from '../propiedades/propiedades.module';

@Module({
  imports: [PropiedadesModule],
  providers: [AgendaService],
  controllers: [AgendaController],
  exports: [AgendaService],
})
export class AgendaModule {}
