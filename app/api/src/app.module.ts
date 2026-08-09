import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ConfiguracionModule } from './configuracion/configuracion.module';
import { IntegrantesEquipoModule } from './integrantes-equipo/integrantes-equipo.module';
import { PropietariosModule } from './propietarios/propietarios.module';
import { PropiedadesModule } from './propiedades/propiedades.module';
import { CajaModule } from './caja/caja.module';
import { CobrosModule } from './cobros/cobros.module';
import { GastosModule } from './gastos/gastos.module';
import { FacturacionModule } from './facturacion/facturacion.module';
import { LiquidacionesModule } from './liquidaciones/liquidaciones.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { IncidenciasModule } from './incidencias/incidencias.module';
import { VentasModule } from './ventas/ventas.module';
import { CartelesModule } from './carteles/carteles.module';
import { ClientesModule } from './clientes/clientes.module';
import { AgendaModule } from './agenda/agenda.module';
import { AvisosModule } from './avisos/avisos.module';
import { ReportesModule } from './reportes/reportes.module';
import { PublicModule } from './public/public.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite por defecto generoso (100 req/min/IP) para toda la API — los
    // únicos endpoints con un límite más estricto son POST /auth/login y
    // POST /public/contacto (@Throttle a nivel de método). El tracker suma
    // el email del body (si lo hay) a la IP: así dos personas detrás de la
    // misma red (ej. la oficina) no comparten el mismo cupo de intentos —
    // cada cuenta/remitente tiene el suyo propio. No afecta al resto de la
    // API (esas rutas no mandan "email" en el body, el tracker queda
    // efectivamente igual a solo la IP).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
        getTracker: (req: Record<string, unknown>) => {
          const body = req.body as Record<string, unknown> | undefined;
          const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
          return `${req.ip}-${email}`;
        },
      },
    ]),
    EmailModule,
    PrismaModule,
    AuthModule,
    UsuariosModule,
    ConfiguracionModule,
    IntegrantesEquipoModule,
    PropietariosModule,
    PropiedadesModule,
    CajaModule,
    CobrosModule,
    GastosModule,
    FacturacionModule,
    LiquidacionesModule,
    ProveedoresModule,
    IncidenciasModule,
    VentasModule,
    CartelesModule,
    ClientesModule,
    AgendaModule,
    AvisosModule,
    ReportesModule,
    PublicModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
