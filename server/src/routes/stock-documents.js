const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

const router = express.Router();
const prisma = new PrismaClient();

function generateDocumentNumber(type) {
  const prefix = type === 'BON_EXPEDITION' ? 'BEXP' : 
                 type === 'BON_ENTREE_DEPOT' ? 'BED' :
                 type === 'BON_TRANSFERT' ? 'BT' :
                 type === 'BON_ENTREE_MAGASIN' ? 'BEM' : 'DOC';
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);
  
  return `${prefix}-${year}${month}-${timestamp}`;
}



router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, depotId, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * limit;
    
    console.log('Stock documents request:', { page, limit, type, status, depotId, dateFrom, dateTo });
    
    const where = {};
    
    if (type) {
      where.type = type;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (depotId) {
      where.OR = [
        { emetteurId: parseInt(depotId) },
        { destinataireId: parseInt(depotId) }
      ];
    }
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    
    const [documents, total] = await Promise.all([
      prisma.stockDocument.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          emetteur: true,
          destinataire: true,
          items: {
            include: {
              product: true
            }
          },
          statusHistory: {
            include: {
              user: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.stockDocument.count({ where })
    ]);
    
    console.log('Found documents:', documents.length, 'Total:', total);
    
    res.json({
      data: documents, // Changed from 'documents' to 'data' to match frontend expectation
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching stock documents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await prisma.stockDocument.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        },
        statusHistory: {
          include: {
            user: true
          },
          orderBy: { createdAt: 'desc' }
        },
        sourceLinks: {
          include: {
            targetDocument: {
              include: {
                emetteur: true,
                destinataire: true
              }
            }
          }
        },
        targetLinks: {
          include: {
            sourceDocument: {
              include: {
                emetteur: true,
                destinataire: true
              }
            }
          }
        }
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching stock document:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du document' });
  }
});

router.post('/expedition', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    console.log('Received expedition request:', { emetteurId, destinataireId, items, notes });
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      console.log('Validation failed:', { emetteurId, destinataireId, itemsLength: items?.length });
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = generateDocumentNumber('BON_EXPEDITION');
    
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_EXPEDITION',
          status: 'PREPARED',
          emetteurId: parseInt(emetteurId),
          destinataireId: parseInt(destinataireId),
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              famille: item.famille,
              quantity: parseInt(item.quantity),
              batch: item.batch || null,
              notes: item.notes || null,
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'PREPARED',
              userId: 1, // Default user for development
              notes: 'Document créé'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory and create stock movements
      for (const item of items) {
        const productId = item.productId;
        const quantity = parseInt(item.quantity);
        const emetteurIdInt = parseInt(emetteurId);

        // Check if MAIN depot has enough stock
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: emetteurIdInt,
              productId: productId
            }
          }
        });

        if (!inventory || inventory.quantity < quantity) {
          throw new Error(`Stock insuffisant pour le produit ID ${productId}. Disponible: ${inventory?.quantity || 0}, Demandé: ${quantity}`);
        }

        // Reduce stock from MAIN depot
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: inventory.quantity - quantity
          }
        });

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: emetteurIdInt,
            quantity: -quantity, // Negative for outgoing
            type: 'OUT',
            fromDepotId: emetteurIdInt,
            toDepotId: parseInt(destinataireId),
            reason: 'EXPEDITION',
            reference: numero,
            userId: 1
          }
        });
      }

      return doc;
    });
    
    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating expedition document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du document' });
  }
});

router.post('/prepare-lot', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = generateDocumentNumber('BON_EXPEDITION');
    
    const document = await prisma.stockDocument.create({
      data: {
        numero,
        type: 'BON_EXPEDITION',
        status: 'PREPARED',
        emetteurId: parseInt(emetteurId),
        destinataireId: parseInt(destinataireId),
        notes,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            famille: item.famille,
            quantity: parseInt(item.quantity),
            batch: item.batch || null,
            notes: item.notes || null,
            barcode: null
          }))
        },
        statusHistory: {
          create: {
            status: 'PREPARED',
            userId: req.user.id,
            notes: 'Lot préparé'
          }
        }
      },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error preparing lot:', error);
    res.status(500).json({ error: 'Erreur lors de la préparation du lot' });
  }
});

router.post('/:id/validate', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { status, notes } = req.body;
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: true,
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé, impossible de modifier' });
    }
    
    const oldStatus = document.status;
    
    const updatedDocument = await prisma.stockDocument.update({
      where: { id: documentId },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            userId: req.user.id,
            notes: notes || `Status changé de ${oldStatus} à ${status}`
          }
        }
      },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', documentId, 'UPDATE', { status: oldStatus }, { status });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { barcode, depotId } = req.body;
    
    if (!barcode || !depotId) {
      return res.status(400).json({ error: 'Code-barres et dépôt requis' });
    }
    
    const item = await prisma.stockDocumentItem.findUnique({
      where: { barcode },
      include: {
        document: {
          include: {
            emetteur: true,
            destinataire: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        product: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Code-barres non trouvé' });
    }
    
    const document = item.document;
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé' });
    }
    
    if (document.destinataireId !== parseInt(depotId)) {
      return res.status(400).json({ 
        error: `Document destiné à ${document.destinataire.name}, pas à ce dépôt` 
      });
    }
    
    if (document.status === 'PREPARED') {
      return res.status(400).json({ error: 'Document non encore envoyé' });
    }
    
    if (document.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Document déjà reçu' });
    }
    
    res.json({
      document,
      item,
      canReceive: document.status === 'SENT'
    });
  } catch (error) {
    console.error('Error scanning barcode:', error);
    res.status(500).json({ error: 'Erreur lors du scan' });
  }
});

router.post('/scan-transfer', authenticateToken, async (req, res) => {
  try {
    const { fromDepotId, toDepotId, barcode } = req.body;
    
    if (!fromDepotId || !toDepotId || !barcode) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const item = await prisma.stockDocumentItem.findUnique({
      where: { barcode },
      include: {
        document: {
          include: {
            emetteur: true,
            destinataire: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        product: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Code-barres non trouvé' });
    }
    
    const document = item.document;
    
    if (document.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Document annulé' });
    }
    
    if (document.destinataireId !== parseInt(toDepotId)) {
      return res.status(400).json({ 
        error: `Document destiné à ${document.destinataire.name}, pas à ce dépôt` 
      });
    }
    
    if (document.status !== 'SENT') {
      return res.status(400).json({ error: 'Document non encore envoyé' });
    }
    
    if (document.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Document déjà reçu' });
    }
    
    const fromInventory = await prisma.inventory.findUnique({
      where: {
        depotId_productId: {
          depotId: parseInt(fromDepotId),
          productId: item.productId
        }
      }
    });
    
    if (!fromInventory || fromInventory.quantity < item.quantity) {
      return res.status(400).json({ 
        error: `Stock insuffisant au dépôt d'origine (${fromInventory?.quantity || 0} < ${item.quantity})` 
      });
    }
    
    res.json({
      document,
      item,
      canTransfer: true,
      availableStock: fromInventory.quantity
    });
  } catch (error) {
    console.error('Error scanning transfer barcode:', error);
    res.status(500).json({ error: 'Erreur lors du scan' });
  }
});

// Get inventory for a depot
router.get('/inventory/:depotId', authenticateToken, async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);
    
    const inventory = await prisma.inventory.findMany({
      where: { depotId },
      include: {
        product: true
      }
    });
    
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'inventaire' });
  }
});

// Create transfer from BRANCH to SHOP
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { emetteurId, destinataireId, items, notes } = req.body;
    
    console.log('Received transfer request:', { emetteurId, destinataireId, items, notes });
    
    if (!emetteurId || !destinataireId || !items || items.length === 0) {
      console.log('Validation failed:', { emetteurId, destinataireId, itemsLength: items?.length });
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    const numero = generateDocumentNumber('BON_TRANSFERT');
    
    const document = await prisma.$transaction(async (tx) => {
      // Create the document
      const doc = await tx.stockDocument.create({
        data: {
          numero,
          type: 'BON_TRANSFERT',
          status: 'PREPARED',
          emetteurId: parseInt(emetteurId),
          destinataireId: parseInt(destinataireId),
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              famille: item.famille,
              quantity: parseInt(item.quantity),
              batch: null,
              notes: null,
              barcode: null
            }))
          },
          statusHistory: {
            create: {
              status: 'PREPARED',
              userId: 1, // Default user for development
              notes: 'Transfert créé'
            }
          }
        },
        include: {
          emetteur: true,
          destinataire: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Update inventory and create stock movements
      for (const item of items) {
        const productId = item.productId;
        const quantity = parseInt(item.quantity);
        const emetteurIdInt = parseInt(emetteurId);

        // Check if BRANCH depot has enough stock
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: emetteurIdInt,
              productId: productId
            }
          }
        });

        if (!inventory || inventory.quantity < quantity) {
          throw new Error(`Stock insuffisant pour le produit ID ${productId}. Disponible: ${inventory?.quantity || 0}, Demandé: ${quantity}`);
        }

        // Reduce stock from BRANCH depot
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: inventory.quantity - quantity
          }
        });

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: productId,
            depotId: emetteurIdInt,
            quantity: -quantity, // Negative for outgoing
            type: 'OUT',
            fromDepotId: emetteurIdInt,
            toDepotId: parseInt(destinataireId),
            reason: 'TRANSFERT',
            reference: numero,
            userId: 1
          }
        });
      }

      return doc;
    });
    
    await logAudit(1, 'stock_documents', document.id, 'CREATE', null, document);
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error creating transfer document:', error);
    res.status(500).json({ error: 'Erreur lors de la création du transfert' });
  }
});

router.post('/:id/receive', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { depotId } = req.body;
    
    console.log('Receive document request:', { documentId, depotId });
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    if (document.destinataireId !== parseInt(depotId)) {
      return res.status(400).json({ error: 'Mauvais dépôt de destination' });
    }
    
    if (document.status !== 'PREPARED') {
      return res.status(400).json({ error: 'Document non prêt pour réception' });
    }
    
    await prisma.$transaction(async (tx) => {
      for (const item of document.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(depotId),
              productId: item.productId
            }
          }
        });
        
        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: inventory.quantity + item.quantity
            }
          });
        } else {
          await tx.inventory.create({
            data: {
              depotId: parseInt(depotId),
              productId: item.productId,
              quantity: item.quantity
            }
          });
        }

        // Create stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            depotId: parseInt(depotId),
            quantity: item.quantity, // Positive for incoming
            type: 'IN',
            fromDepotId: document.emetteurId,
            toDepotId: parseInt(depotId),
            reason: document.type === 'BON_EXPEDITION' ? 'RECEPTION_EXPEDITION' : 'RECEPTION_TRANSFERT',
            reference: document.numero,
            userId: 1
          }
        });
      }
      
      await tx.stockDocument.update({
        where: { id: documentId },
        data: {
          status: 'RECEIVED',
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: 'Document reçu'
            }
          }
        }
      });
    });
    
    const updatedDocument = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        emetteur: true,
        destinataire: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    await logAudit(req.user.id, 'stock_documents', documentId, 'UPDATE', { status: 'SENT' }, { status: 'RECEIVED' });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error receiving document:', error);
    res.status(500).json({ error: 'Erreur lors de la réception' });
  }
});

router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { fromDepotId, toDepotId, items, notes } = req.body;
    
    if (!fromDepotId || !toDepotId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Données manquantes' });
    }
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(fromDepotId),
              productId: item.productId
            }
          }
        });
        
        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour ${item.product.name}`);
        }
        
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: inventory.quantity - item.quantity
          }
        });
        
        const targetInventory = await tx.inventory.findUnique({
          where: {
            depotId_productId: {
              depotId: parseInt(toDepotId),
              productId: item.productId
            }
          }
        });
        
        if (targetInventory) {
          await tx.inventory.update({
            where: { id: targetInventory.id },
            data: {
              quantity: targetInventory.quantity + item.quantity
            }
          });
        } else {
          await tx.inventory.create({
            data: {
              depotId: parseInt(toDepotId),
              productId: item.productId,
              quantity: item.quantity
            }
          });
        }
      }
      
      const transferDoc = await tx.stockDocument.create({
        data: {
          numero: generateDocumentNumber('BON_TRANSFERT'),
          type: 'BON_TRANSFERT',
          status: 'RECEIVED',
          emetteurId: parseInt(fromDepotId),
          destinataireId: parseInt(toDepotId),
          notes,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              famille: item.famille,
              quantity: parseInt(item.quantity),
              batch: item.batch,
              notes: item.notes
            }))
          },
          statusHistory: {
            create: {
              status: 'RECEIVED',
              userId: req.user.id,
              notes: 'Transfert effectué'
            }
          }
        }
      });
      
      await logAudit(req.user.id, 'stock_documents', transferDoc.id, 'CREATE', null, transferDoc);
    });
    
    res.json({ message: 'Transfert effectué avec succès' });
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({ error: error.message || 'Erreur lors du transfert' });
  }
});

router.get('/:id/print-labels', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    const labels = document.items.map(item => ({
      barcode: item.barcode,
      productName: item.product.name,
      famille: item.famille,
      quantity: item.quantity,
      batch: item.batch,
      documentNumber: document.numero,
      emetteur: document.emetteur.name,
      destinataire: document.destinataire.name
    }));
    
    res.json({ labels, document });
  } catch (error) {
    console.error('Error generating labels:', error);
    res.status(500).json({ error: 'Erreur lors de la génération des étiquettes' });
  }
});

router.get('/:id/export-pdf', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    
    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        emetteur: true,
        destinataire: true,
        statusHistory: {
          include: {
            user: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }
    
    const pdfData = {
      document,
      qrCode: document.numero,
      signatureZone: 'Signature du responsable'
    };
    
    res.json(pdfData);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export PDF' });
  }
});

module.exports = router; 