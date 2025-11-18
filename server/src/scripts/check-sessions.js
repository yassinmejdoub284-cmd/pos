const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSessions() {
  try {
    console.log('=== Vérification des sessions dans la base de données ===\n');
    
    // Check specific sessions that are failing
    const sessionIds = [8, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    
    console.log(`Vérification des sessions: ${sessionIds.join(', ')}\n`);
    
    for (const sessionId of sessionIds) {
      const session = await prisma.sessionCaisse.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          depotId: true,
          status: true,
          openedAt: true,
          closedAt: true,
          userId: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          depot: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });
      
      if (session) {
        console.log(`✓ Session ${sessionId}:`);
        console.log(`  - Status: ${session.status}`);
        console.log(`  - DepotId: ${session.depotId || 'NULL'}`);
        console.log(`  - Depot: ${session.depot ? `${session.depot.name} (${session.depot.code})` : 'Aucun'}`);
        console.log(`  - User: ${session.user.firstName} ${session.user.lastName}`);
        console.log(`  - Ouverte: ${session.openedAt}`);
        console.log(`  - Fermée: ${session.closedAt || 'Non fermée'}`);
        console.log('');
      } else {
        console.log(`✗ Session ${sessionId}: N'EXISTE PAS dans la base de données\n`);
      }
    }
    
    // Check all sessions with their depotIds
    console.log('\n=== Statistiques des sessions ===\n');
    
    const totalSessions = await prisma.sessionCaisse.count();
    const sessionsWithDepot = await prisma.sessionCaisse.count({
      where: { depotId: { not: null } }
    });
    const sessionsWithoutDepot = await prisma.sessionCaisse.count({
      where: { depotId: null }
    });
    
    console.log(`Total de sessions: ${totalSessions}`);
    console.log(`Sessions avec depotId: ${sessionsWithDepot}`);
    console.log(`Sessions sans depotId (NULL): ${sessionsWithoutDepot}`);
    
    // Check sessions by depot
    console.log('\n=== Sessions par dépôt ===\n');
    const sessionsByDepot = await prisma.sessionCaisse.groupBy({
      by: ['depotId'],
      _count: {
        id: true
      },
      orderBy: {
        depotId: 'asc'
      }
    });
    
    for (const group of sessionsByDepot) {
      const depotInfo = group.depotId 
        ? await prisma.depot.findUnique({
            where: { id: group.depotId },
            select: { name: true, code: true }
          })
        : null;
      
      console.log(`DepotId ${group.depotId || 'NULL'}: ${group._count.id} sessions ${depotInfo ? `(${depotInfo.name} - ${depotInfo.code})` : ''}`);
    }
    
    // Check change requests
    console.log('\n=== Vérification des Change Requests ===\n');
    const changeRequests = await prisma.changeRequest.findMany({
      where: {
        entityType: 'SESSION_CAISSE',
        entityId: { in: sessionIds }
      },
      select: {
        id: true,
        entityId: true,
        status: true,
        type: true
      }
    });
    
    console.log(`Change requests trouvées: ${changeRequests.length}`);
    for (const cr of changeRequests) {
      const session = await prisma.sessionCaisse.findUnique({
        where: { id: cr.entityId },
        select: { id: true, depotId: true }
      });
      
      console.log(`  - ChangeRequest ${cr.id}: Session ${cr.entityId} (${session ? `existe, depotId: ${session.depotId || 'NULL'}` : 'N\'EXISTE PAS'})`);
    }
    
  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSessions();

