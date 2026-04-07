import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Crear usuarios
  const adminPassword = await bcrypt.hash('admin123', 10);
  const vendedorPassword = await bcrypt.hash('vendedor123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@inventario.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@inventario.com',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'vendedor@inventario.com' },
    update: {},
    create: {
      name: 'Vendedor',
      email: 'vendedor@inventario.com',
      password: vendedorPassword,
      role: Role.VENDEDOR,
    },
  });

  // Crear categorías
  const categorias = [
    { name: 'Vidrios', description: 'Vidrios y pantallas' },
    { name: 'Accesorios', description: 'Accesorios para celulares' },
    { name: 'Perfumes', description: 'Perfumes y fragancias' },
    { name: 'Herramientas', description: 'Herramientas de reparación' },
    { name: 'Electronica', description: 'Productos electrónicos' },
    { name: 'Case', description: 'Fundas y protectores' },
    { name: 'Otros', description: 'Otros productos' },
  ];

  for (const cat of categorias) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: cat,
    });
  }

  console.log('Seed ejecutado correctamente');
  console.log('Usuarios creados:');
  console.log('  Admin: admin@inventario.com / admin123');
  console.log('  Vendedor: vendedor@inventario.com / vendedor123');
  console.log('Categorías creadas:', categorias.map(c => c.name).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
