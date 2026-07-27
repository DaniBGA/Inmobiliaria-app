import { Module } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [ConfiguracionModule],
  providers: [CajaService],
  controllers: [CajaController],
  exports: [CajaService],
})
export class CajaModule {}
