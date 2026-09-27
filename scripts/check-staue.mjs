import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const images = await prisma.image.findMany({
    where: {
      OR: [
        { storagePath: { contains: 'staue' } },
        { originalName: { contains: 'staue' } },
        { publicUrl: { contains: 'staue' } },
        { storagePath: { contains: 'svg' } }
      ]
    }
  });
  console.log('Matching images in DB:', images);
  await prisma.$disconnect();
}

main().catch(console.error);
