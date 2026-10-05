const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSettings() {
  const updates = {
    businessName: 'Rajesh Guleria Official',
    phone: '+91 9872889201',
    whatsapp: '9872889201',
    email: 'rajeshguleria@yahoo.com, rajeshguleria1973@gmail.com',
    address: 'House Number 755, Sector 43 A, Chandigarh (Near Shakambhari Devi Temple)',
    businessHours: 'Monday - Saturday: 10:00 AM - 6:00 PM\nSunday: Closed',
    footerText: '© 2026 Rajesh Guleria Official. All rights reserved.',
    disclaimer: 'This website provides professional assistance and consultation services. It is not an official website of LIC, the Income Tax Department, GST Portal, or any government authority.'
  };

  for (const [key, value] of Object.entries(updates)) {
    await prisma.businessSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }
  console.log('Settings updated successfully');
}

updateSettings().finally(() => prisma.$disconnect());
