import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { CobrosModule } from '../cobros/cobros.module';

@Module({
  imports: [CobrosModule],
  providers: [ReportesService],
  controllers: [ReportesController],
  exports: [ReportesService],
})
export class ReportesModule {}
