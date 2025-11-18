const { prisma } = require('../lib/prisma');

/**
 * Script to grant a user access to multiple depots
 * Since the system supports one primary depot per user, we'll:
 * 1. Set one depot as the primary depot (depotId)
 * 2. The user can access the other depot via visiting depot mechanism (x-depot-id header)
 */

async function grantDepotAccess() {
  try {
    // Find the depots: Ariena and Boutique Centre Ville Sfax
    // Try by ID first (based on database structure: depot 3 = Centre Ville, depot 4 = Ariena)
    let arienaDepot = await prisma.depot.findUnique({ where: { id: 4 } });
    if (!arienaDepot) {
      arienaDepot = await prisma.depot.findFirst({
        where: {
          OR: [
            { name: { contains: 'Ariena' } },
            { name: { contains: 'Ariana' } },
            { code: '002' }
          ]
        }
      });
    }

    let centreVilleDepot = await prisma.depot.findUnique({ where: { id: 3 } });
    if (!centreVilleDepot) {
      centreVilleDepot = await prisma.depot.findFirst({
        where: {
          OR: [
            { name: { contains: 'Centre Ville' } },
            { name: { contains: 'Centre' } },
            { code: 'SHOP-CV' }
          ]
        }
      });
    }

    console.log('\n=== Available Depots ===');
    if (arienaDepot) {
      console.log(`✓ Depot ${arienaDepot.id}: ${arienaDepot.name} (${arienaDepot.code})`);
    } else {
      console.log('✗ Ariena depot not found');
    }

    if (centreVilleDepot) {
      console.log(`✓ Depot ${centreVilleDepot.id}: ${centreVilleDepot.name} (${centreVilleDepot.code})`);
    } else {
      console.log('✗ Boutique Centre Ville depot not found');
    }

    if (!arienaDepot || !centreVilleDepot) {
      console.log('\nError: Could not find both depots. Please check the database.');
      process.exit(1);
    }

    // List all users
    console.log('\n=== Available Users ===');
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true
      },
      orderBy: { username: 'asc' }
    });

    users.forEach(user => {
      const depotInfo = user.depotId ? ` (Depot: ${user.depotId})` : ' (No depot)';
      console.log(`  ${user.id}. ${user.firstName} ${user.lastName} (${user.username}) - ${user.role}${depotInfo}`);
    });

    // Get user ID from command line argument
    const userIdArg = process.argv[2];
    if (!userIdArg) {
      console.log('\nUsage: node grant-depot-access.js <userId>');
      console.log('\nExample: node grant-depot-access.js 5');
      console.log('\nThis will set the user\'s primary depot to Boutique Centre Ville (depot 3)');
      console.log('and they can access Ariena (depot 4) via visiting depot mechanism.');
      process.exit(1);
    }

    const userId = parseInt(userIdArg);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        depotId: true
      }
    });

    if (!user) {
      console.log(`\nError: User with ID ${userId} not found.`);
      process.exit(1);
    }

    console.log(`\n=== Updating User ===`);
    console.log(`User: ${user.firstName} ${user.lastName} (${user.username})`);
    console.log(`Current depot: ${user.depotId || 'None'}`);

    // Set primary depot to Boutique Centre Ville (depot 3)
    // User can access Ariena (depot 4) via visiting depot header
    const primaryDepotId = centreVilleDepot.id;
    const secondaryDepotId = arienaDepot.id;

    await prisma.user.update({
      where: { id: userId },
      data: { depotId: primaryDepotId }
    });

    console.log(`\n✓ Successfully updated user's primary depot to: ${centreVilleDepot.name} (ID: ${primaryDepotId})`);
    console.log(`\n=== Access Information ===`);
    console.log(`Primary Depot: ${centreVilleDepot.name} (ID: ${primaryDepotId})`);
    console.log(`  - User can access this depot directly (no header needed)`);
    console.log(`\nSecondary Depot: ${arienaDepot.name} (ID: ${secondaryDepotId})`);
    console.log(`  - User can access this depot by setting visitingDepotId in sessionStorage`);
    console.log(`  - The system will automatically add the X-Depot-Id header`);
    console.log(`  - Example: sessionStorage.setItem('visitingDepotId', '${secondaryDepotId}')`);

    console.log('\n✓ User now has access to both depots!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

grantDepotAccess();

