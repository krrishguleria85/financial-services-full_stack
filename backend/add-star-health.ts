import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const service = {
    name: 'Star Health Insurance',
    slug: 'star-health-insurance',
    category: 'health-insurance',
    description: 'Comprehensive health insurance plans from Star Health for individuals, families, and senior citizens.',
    longDescription: 'As an Authorized Agent for Star Health and Allied Insurance, I provide expert guidance on choosing the right health coverage for you and your family. Star Health is India\'s first standalone health insurance provider, offering a wide range of plans including Family Floater, Senior Citizen, and comprehensive individual plans. Protect your savings from unexpected medical emergencies with cashless hospitalization and wide network coverage.',
    icon: 'HeartPulse',
    sortOrder: 0,
    isActive: true,
  };

  await prisma.service.upsert({
    where: { slug: service.slug },
    update: service,
    create: service,
  });
  
  console.log('✅ Star Health Insurance service added!');
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
