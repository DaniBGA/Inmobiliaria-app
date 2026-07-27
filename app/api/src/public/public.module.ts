import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicPropiedadesService } from './public-propiedades.service';
import { ClientesModule } from '../clientes/clientes.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [ClientesModule, ConfiguracionModule],
  controllers: [PublicController],
  providers: [PublicPropiedadesService],
})
export class PublicModule {}
