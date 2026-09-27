import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const images = await prisma.image.findMany({
    where: {
      publicUrl: { contains: '&mode=admin' }
    }
  });

  console.log(`Found ${images.length} images with &mode=admin in publicUrl`);

  for (const img of images) {
    const cleanUrl = img.publicUrl.replace('&mode=admin', '');
    await prisma.image.update({
      where: { id: img.id },
      data: { publicUrl: cleanUrl }
    });
  }

  console.log('All publicUrls cleaned successfully!');
  await prisma.$disconnect();
}

main().catch(console.error);
