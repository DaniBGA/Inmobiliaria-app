import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { integranteEquipo: { select: { id: true } } },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inválido o inactivo.');
    }
    const { passwordHash: _omit, integranteEquipo, ...seguro } = usuario;
    // `integranteEquipoId` es lo que un designado (rol EQUIPO) necesita para
    // filtrar "lo suyo" en Clientes/Ventas/Carteles (delegadoId/designadoId
    // referencian IntegranteEquipo, no Usuario — a diferencia de
    // EventoAgenda.usuarioId, que sí usa el id de Usuario directamente).
    return { ...seguro, integranteEquipoId: integranteEquipo?.id ?? null };
  }
}
