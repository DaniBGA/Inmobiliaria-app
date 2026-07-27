import { Module } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';

@Module({
  providers: [ConfiguracionService],
  controllers: [ConfiguracionController],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
