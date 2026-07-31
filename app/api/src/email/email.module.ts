import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

// @Global porque el envío de notificaciones es transversal (hoy Public,
// potencialmente otros módulos más adelante) — evita repetir el import en
// cada módulo que necesite mandar un email.
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
