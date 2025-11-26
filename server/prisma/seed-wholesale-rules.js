const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedWholesaleRules() {
  try {


    // Create default wholesale rules
    const defaultRules = [
      {
        ruleType: 'percentage',
        value: 10,
        description: 'Remise 10%'
      },
      {
        ruleType: 'percentage',
        value: 12,
        description: 'Remise 12%'
      },
      {
        ruleType: 'percentage',
        value: 15,
        description: 'Remise 15%'
      },
      {
        ruleType: 'fixed',
        value: 10,
        description: 'Prix fixe 10dt'
      },
      {
        ruleType: 'fixed',
        value: 15,
        description: 'Prix fixe 15dt'
      },
      {
        ruleType: 'discount',
        value: 1,
        description: 'Remise -1dt'
      }
    ];

    for (const rule of defaultRules) {
      // Check if rule already exists
      const existingRule = await prisma.wholesaleRule.findFirst({
        where: { 
          description: rule.description 
        }
      });

      if (!existingRule) {
        await prisma.wholesaleRule.create({
          data: rule
        });

      } else {

      }
    }


  } catch (error) {
    console.error('Error seeding wholesale rules:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedWholesaleRules();
