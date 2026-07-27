import { Module } from '@nestjs/common';
import { CartelesService } from './carteles.service';
import { CartelesController } from './carteles.controller';

@Module({
  providers: [CartelesService],
  controllers: [CartelesController],
  exports: [CartelesService],
})
export class CartelesModule {}
