import { Module } from '@nestjs/common';
import { IncidenciasService } from './incidencias.service';
import { IncidenciasController } from './incidencias.controller';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { GastosModule } from '../gastos/gastos.module';

@Module({
  imports: [ProveedoresModule, GastosModule],
  providers: [IncidenciasService],
  controllers: [IncidenciasController],
  exports: [IncidenciasService],
})
export class IncidenciasModule {}
