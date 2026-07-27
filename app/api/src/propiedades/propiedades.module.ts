import { Module } from '@nestjs/common';
import { PropiedadesService } from './propiedades.service';
import { PropiedadesController } from './propiedades.controller';

@Module({
  providers: [PropiedadesService],
  controllers: [PropiedadesController],
  exports: [PropiedadesService],
})
export class PropiedadesModule {}
