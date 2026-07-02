import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.issuer.upsert({
    where: { issuerId: 'UNDIP' },
    update: {
      organizationName: 'Universitas Diponegoro',
      departmentName: 'Fakultas Teknik',
      mspId: 'Org1MSP',
      username: 'admin',
      email: 'admin@undip.ac.id',
      passwordHash,
      isActive: true,
      status: 'ACTIVE'
    },
    create: {
      issuerId: 'UNDIP',
      organizationName: 'Universitas Diponegoro',
      departmentName: 'Fakultas Teknik',
      mspId: 'Org1MSP',
      username: 'admin',
      email: 'admin@undip.ac.id',
      passwordHash,
      isActive: true,
      status: 'ACTIVE'
    }
  });
}

main()
  .catch(async (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
