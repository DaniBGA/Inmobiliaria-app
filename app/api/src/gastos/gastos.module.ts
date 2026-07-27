import { Module } from '@nestjs/common';
import { GastosService } from './gastos.service';
import { GastosController } from './gastos.controller';
import { CajaModule } from '../caja/caja.module';

@Module({
  imports: [CajaModule],
  providers: [GastosService],
  controllers: [GastosController],
  exports: [GastosService],
})
export class GastosModule {}
