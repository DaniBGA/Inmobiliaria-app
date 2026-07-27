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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite por defecto generoso (100 req/min/IP) para toda la API —
    // el único endpoint con un límite más estricto es POST /public/contacto
    // (@Throttle a nivel de método, la única escritura sin autenticación).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
