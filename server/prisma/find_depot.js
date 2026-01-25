const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const depots = await prisma.depot.findMany({
        where: {
            name: { contains: 'Centre' }
        },
        select: { id: true, name: true, code: true }
    });
    console.log(JSON.stringify(depots, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
