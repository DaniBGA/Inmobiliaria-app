import { Module } from '@nestjs/common';
import { PropietariosService } from './propietarios.service';
import { PropietariosController } from './propietarios.controller';

@Module({
  providers: [PropietariosService],
  controllers: [PropietariosController],
  exports: [PropietariosService],
})
export class PropietariosModule {}
