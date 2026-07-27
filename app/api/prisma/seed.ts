import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@facundoparis.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';

async function main() {
  // Configuración es una fila singleton (id fijo = 1): el resto del sistema
  // siempre lee/escribe sobre este único registro (§3.7 del documento funcional).
  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      diaVencimientoAlquiler: 10,
      diasAnticipacionAumento: 30,
      diasAnticipacionVencimiento: 30,
    },
  });
  console.log('Configuración inicial (id=1) lista.');

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!adminExistente) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        email: ADMIN_EMAIL,
        passwordHash,
        rol: RolUsuario.ADMIN,
      },
    });
    console.log(
      `Usuario admin creado -> email: ${ADMIN_EMAIL} / password: ${ADMIN_PASSWORD} (cambiarla luego del primer login)`,
    );
  } else {
    console.log('Usuario admin ya existía, no se recreó.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
