const { prisma } = require('../lib/prisma');

/**
 * Script to grant admin access to a user
 */

async function grantAdminAccess() {
  try {
    const userIdArg = process.argv[2];
    if (!userIdArg) {
      console.log('\nUsage: node grant-admin-access.js <userId>');
      console.log('\nExample: node grant-admin-access.js 7');
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
    console.log(`Current role: ${user.role}`);
    console.log(`Current depot: ${user.depotId || 'None'}`);

    // Update user role to ADMIN
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' }
    });

    console.log(`\n✓ Successfully updated user's role to: ADMIN`);
    console.log(`\n⚠️  Note: User now has full admin access to all depots and features.`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

grantAdminAccess();

