import { Module } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { PagosProveedorService } from './pagos-proveedor.service';
import { ProveedoresController } from './proveedores.controller';
import { CajaModule } from '../caja/caja.module';

@Module({
  imports: [CajaModule],
  providers: [ProveedoresService, PagosProveedorService],
  controllers: [ProveedoresController],
  exports: [ProveedoresService, PagosProveedorService],
})
export class ProveedoresModule {}
