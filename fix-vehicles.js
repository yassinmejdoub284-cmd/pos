const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixVehicleModels() {
  try {
    console.log('Checking vehicles with [object Object] models...');
    
    // Find all vehicles
    const vehicles = await prisma.vehicle.findMany({
      include: {
        brand: true
      }
    });
    
    console.log(`Found ${vehicles.length} vehicles`);
    
    let fixedCount = 0;
    
    for (const vehicle of vehicles) {
      console.log(`Vehicle ID: ${vehicle.id}, Matricule: ${vehicle.matricule}, Model: "${vehicle.model}"`);
      
      // Check if model is [object Object]
      if (vehicle.model === '[object Object]') {
        console.log(`Fixing vehicle ${vehicle.id} with [object Object] model`);
        
        // Try to get the model from the brand's models array
        if (vehicle.brand && vehicle.brand.models) {
          try {
            const brandModels = JSON.parse(vehicle.brand.models);
            if (brandModels && brandModels.length > 0) {
              // Use the first model as default
              const defaultModel = brandModels[0];
              console.log(`Setting model to: ${defaultModel}`);
              
              await prisma.vehicle.update({
                where: { id: vehicle.id },
                data: { model: defaultModel }
              });
              
              fixedCount++;
              console.log(`Fixed vehicle ${vehicle.id}`);
            } else {
              // If no models in brand, set a default
              await prisma.vehicle.update({
                where: { id: vehicle.id },
                data: { model: 'Unknown' }
              });
              fixedCount++;
              console.log(`Set vehicle ${vehicle.id} model to 'Unknown'`);
            }
          } catch (error) {
            console.error(`Error parsing brand models for vehicle ${vehicle.id}:`, error);
            // Set to Unknown if parsing fails
            await prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { model: 'Unknown' }
            });
            fixedCount++;
          }
        } else {
          // No brand info, set to Unknown
          await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { model: 'Unknown' }
          });
          fixedCount++;
          console.log(`Set vehicle ${vehicle.id} model to 'Unknown' (no brand info)`);
        }
      }
    }
    
    console.log(`\nDone! Fixed ${fixedCount} vehicles with [object Object] models`);
  } catch (error) {
    console.error('Error fixing vehicle models:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixVehicleModels();
