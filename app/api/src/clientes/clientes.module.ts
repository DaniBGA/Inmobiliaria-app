import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { AgendaModule } from '../agenda/agenda.module';

@Module({
  imports: [AgendaModule],
  providers: [ClientesService],
  controllers: [ClientesController],
  exports: [ClientesService],
})
export class ClientesModule {}
