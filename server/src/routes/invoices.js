const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
// PDF service removed - using HTML print instead

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to calculate HTVA and TVA from TTC
function calculateHTVAAndTVA(prixTTC, tvaPercent) {
  const prixHTVA = prixTTC / (1 + tvaPercent / 100);
  const montantTVA = prixTTC - prixHTVA;
  return {
    prixHTVA: Math.round(prixHTVA * 100) / 100,
    montantTVA: Math.round(montantTVA * 100) / 100
  };
}

// Helper function to get next invoice number
async function getNextInvoiceNumber(depotId) {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { depotId },
    orderBy: { invoiceNumber: 'desc' }
  });
  
  if (!lastInvoice) {
    return 'FAC-001';
  }
  
  const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1]);
  return `FAC-${String(lastNumber + 1).padStart(3, '0')}`;
}

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, source } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {
      depotId: req.user.depotId
    };
    
    if (status) where.status = status;
    if (source) where.source = source;
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client: true,
          createdBy: {
            select: { firstName: true, lastName: true }
          },
          lines: {
            include: {
              product: {
                include: {
                  famille: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.invoice.count({ where })
    ]);
    
    res.json({
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoice requests for current user (for cashiers to see their own requests)
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    console.log('Getting invoice requests for user:', req.user?.role, req.user?.id);
    
    const requests = await prisma.invoiceRequest.findMany({
      where: { 
        sale: {
          userId: req.user.id // Only show requests for sales made by this user
        }
      },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    famille: true
                  }
                }
              }
            },
            client: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ requests });
  } catch (error) {
    console.error('Error getting invoice requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoice by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        depotId: req.user.depotId
      },
      include: {
        client: true,
        createdBy: {
          select: { firstName: true, lastName: true }
        },
        lines: {
          include: {
            product: {
              include: {
                famille: true
              }
            }
          }
        }
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice directly
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      clientId,
      items,
      totalAmount,
      status = 'DRAFT'
    } = req.body;
    
    // Validate required fields
    if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Client ID and items are required' 
      });
    }
    
    // Get client information
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Get next invoice number
    const invoiceNumber = await getNextInvoiceNumber(req.user.depotId);
    
    // Get app settings for company info
    const appSettings = await prisma.appSettings.findFirst();
    const depot = await prisma.depot.findUnique({
      where: { id: req.user.depotId }
    });
    
    // Calculate totals
    let subtotalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    const invoiceLines = [];
    
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { famille: true }
      });
      
      if (!product) continue;
      
      const { prixHTVA, montantTVA } = calculateHTVAAndTVA(
        item.unitPrice, 
        parseFloat(product.tva)
      );
      
      const sousTotalTTC = item.quantity * item.unitPrice;
      const sousTotalHTVA = item.quantity * prixHTVA;
      const sousTotalTVA = item.quantity * montantTVA;
      
      subtotalHTVA += sousTotalHTVA;
      totalTVA += sousTotalTVA;
      totalTTC += sousTotalTTC;
      
      invoiceLines.push({
        productId: product.id,
        familleName: product.famille.name,
        productName: product.name,
        legalDesignation: product.designation_legale,
        unite: product.unite,
        quantity: item.quantity,
        prixVenteTTC: item.unitPrice,
        prixVenteHTVA: prixHTVA,
        tvaPercent: parseFloat(product.tva),
        montantTVA: montantTVA,
        sousTotalTTC: sousTotalTTC
      });
    }
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: status,
        source: 'TICKET_REQUEST',
        issueDate: new Date(),
        companyName: appSettings?.companyName || depot.name,
        companyAddress: depot.address,
        companyMatricule: appSettings?.companyMatricule,
        customerName: `${client.firstName} ${client.lastName}`,
        customerAddress: client.address,
        customerMatricule: client.matricule,
        subtotalHTVA,
        totalTVA,
        totalTTC,
        depotId: req.user.depotId,
        clientId: client.id,
        createdById: req.user.id,
        lines: {
          create: invoiceLines
        }
      },
      include: {
        client: true,
        createdBy: {
          select: { firstName: true, lastName: true }
        },
        lines: {
          include: {
            product: {
              include: {
                famille: true
              }
            }
          }
        }
      }
    });

    // Add additional fields that the frontend expects
    invoice.numero = invoice.invoiceNumber;
    invoice.createdAt = invoice.issueDate;
    
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice from daily extract
router.post('/from-extract', authenticateToken, async (req, res) => {
  try {
    const {
      date,
      invoiceNumber,
      customerInfo,
      lines,
      notes
    } = req.body;
    
    // Validate invoice number uniqueness
    const existingInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber }
    });
    
    if (existingInvoice) {
      return res.status(400).json({ 
        error: 'Numéro de facture déjà existant. Choisissez un autre.' 
      });
    }
    
    // Get app settings for company info
    const appSettings = await prisma.appSettings.findFirst();
    const depot = await prisma.depot.findUnique({
      where: { id: req.user.depotId }
    });
    
    // Calculate totals
    let subtotalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    const invoiceLines = [];
    
    for (const line of lines) {
      const product = await prisma.product.findUnique({
        where: { id: line.productId },
        include: { famille: true }
      });
      
      if (!product) continue;
      
      const { prixHTVA, montantTVA } = calculateHTVAAndTVA(
        line.prixVenteTTC, 
        parseFloat(product.tva)
      );
      
      const sousTotalTTC = line.quantity * line.prixVenteTTC;
      const sousTotalHTVA = line.quantity * prixHTVA;
      const sousTotalTVA = line.quantity * montantTVA;
      
      subtotalHTVA += sousTotalHTVA;
      totalTVA += sousTotalTVA;
      totalTTC += sousTotalTTC;
      
      invoiceLines.push({
        productId: product.id,
        familleName: product.famille.name,
        productName: product.name,
        legalDesignation: product.designation_legale,
        unite: product.unite,
        quantity: line.quantity,
        prixVenteTTC: line.prixVenteTTC,
        prixVenteHTVA: prixHTVA,
        tvaPercent: parseFloat(product.tva),
        montantTVA: montantTVA,
        sousTotalTTC: sousTotalTTC
      });
    }
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: 'ISSUED',
        source: 'DAILY_EXTRACT',
        issueDate: new Date(date),
        companyName: appSettings?.companyName || depot.name,
        companyAddress: depot.address,
        companyMatricule: appSettings?.companyMatricule,
        customerName: customerInfo.name,
        customerAddress: customerInfo.address,
        customerMatricule: customerInfo.matricule,
        subtotalHTVA,
        totalTVA,
        totalTTC,
        depotId: req.user.depotId,
        clientId: customerInfo.clientId || null,
        createdById: req.user.id,
        notes,
        lines: {
          create: invoiceLines
        }
      },
      include: {
        lines: {
          include: {
            product: {
              include: {
                famille: true
              }
            }
          }
        }
      }
    });
    
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice from extract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice request from ticket
router.post('/request-from-ticket', authenticateToken, async (req, res) => {
  try {
    const { saleId, requestNotes } = req.body;
    
    // Verify sale exists and belongs to user's depot
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        depotId: req.user.depotId,
        status: 'COMPLETED'
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                famille: true
              }
            }
          }
        },
        client: true
      }
    });
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found or not completed' });
    }
    
    // Check if invoice request already exists for this sale
    const existingRequest = await prisma.invoiceRequest.findFirst({
      where: { saleId }
    });
    
    if (existingRequest) {
      return res.status(400).json({ 
        error: 'Une demande de facture existe déjà pour ce ticket' 
      });
    }
    
    // Create invoice request
    const invoiceRequest = await prisma.invoiceRequest.create({
      data: {
        saleId,
        requestedById: req.user.id,
        requestNotes,
        status: 'PENDING'
      },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    famille: true
                  }
                }
              }
            },
            client: true
          }
        },
        requestedBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });
    
    res.status(201).json(invoiceRequest);
  } catch (error) {
    console.error('Error creating invoice request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoice requests (for admin approval)
router.get('/requests/pending', authenticateToken, async (req, res) => {
  try {
    console.log('Getting pending invoice requests for user:', req.user.role);
    
    const requests = await prisma.invoiceRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    famille: true
                  }
                }
              }
            },
            client: true,
            depot: true
          }
        },
        requestedBy: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('Found invoice requests:', requests.length);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching invoice requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve invoice request
router.post('/requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    
    const { invoiceNumber } = req.body;
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Validate invoice number uniqueness
    const existingInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber }
    });
    
    if (existingInvoice) {
      return res.status(400).json({ 
        error: 'Numéro de facture déjà existant. Choisissez un autre.' 
      });
    }
    
    // Get the request
    const invoiceRequest = await prisma.invoiceRequest.findUnique({
      where: { id: requestId },
      include: {
        sale: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    famille: true
                  }
                }
              }
            },
            client: true,
            depot: true
          }
        }
      }
    });
    
    if (!invoiceRequest || invoiceRequest.status !== 'PENDING') {
      return res.status(404).json({ error: 'Request not found or not pending' });
    }
    
    // Get app settings for company info
    const appSettings = await prisma.appSettings.findFirst();
    
    // Calculate totals
    let subtotalHTVA = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    
    const invoiceLines = [];
    
    for (const item of invoiceRequest.sale.items) {
      const { prixHTVA, montantTVA } = calculateHTVAAndTVA(
        parseFloat(item.unitPrice), 
        parseFloat(item.product.tva)
      );
      
      const sousTotalTTC = parseFloat(item.total);
      const sousTotalHTVA = item.quantity * prixHTVA;
      const sousTotalTVA = item.quantity * montantTVA;
      
      subtotalHTVA += sousTotalHTVA;
      totalTVA += sousTotalTVA;
      totalTTC += sousTotalTTC;
      
      invoiceLines.push({
        productId: item.product.id,
        familleName: item.product.famille.name,
        productName: item.product.name,
        legalDesignation: item.product.designation_legale,
        unite: item.product.unite,
        quantity: item.quantity,
        prixVenteTTC: parseFloat(item.unitPrice),
        prixVenteHTVA: prixHTVA,
        tvaPercent: parseFloat(item.product.tva),
        montantTVA: montantTVA,
        sousTotalTTC: sousTotalTTC
      });
    }
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status: 'ISSUED',
        source: 'TICKET_REQUEST',
        issueDate: new Date(),
        companyName: appSettings?.companyName || invoiceRequest.sale.depot.name,
        companyAddress: invoiceRequest.sale.depot.address,
        companyMatricule: appSettings?.companyMatricule,
        customerName: invoiceRequest.sale.client 
          ? `${invoiceRequest.sale.client.firstName} ${invoiceRequest.sale.client.lastName}`
          : 'Client anonyme',
        customerAddress: invoiceRequest.sale.client?.address,
        customerMatricule: invoiceRequest.sale.client?.matricule,
        subtotalHTVA,
        totalTVA,
        totalTTC,
        depotId: invoiceRequest.sale.depotId,
        clientId: invoiceRequest.sale.clientId,
        createdById: req.user.id,
        saleId: invoiceRequest.saleId,
        lines: {
          create: invoiceLines
        }
      }
    });
    
    // Update request status
    await prisma.invoiceRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id,
        approvedAt: new Date(),
        invoiceId: invoice.id,
        invoiceNumber
      }
    });
    
    res.json({ 
      message: 'Invoice request approved and invoice created',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber
      }
    });
  } catch (error) {
    console.error('Error approving invoice request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject invoice request
router.post('/requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    
    const { rejectionReason } = req.body;
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    const invoiceRequest = await prisma.invoiceRequest.findUnique({
      where: { id: requestId }
    });
    
    if (!invoiceRequest || invoiceRequest.status !== 'PENDING') {
      return res.status(404).json({ error: 'Request not found or not pending' });
    }
    
    await prisma.invoiceRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedById: req.user.id,
        approvedAt: new Date(),
        rejectionReason
      }
    });
    
    res.json({ message: 'Invoice request rejected' });
  } catch (error) {
    console.error('Error rejecting invoice request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get next invoice number suggestion
router.get('/next-number', authenticateToken, async (req, res) => {
  try {
    const nextNumber = await getNextInvoiceNumber(req.user.depotId);
    res.json({ nextInvoiceNumber: nextNumber });
  } catch (error) {
    console.error('Error getting next invoice number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark invoice as printed
router.patch('/:id/mark-printed', authenticateToken, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        depotId: req.user.depotId
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Update the invoice to mark it as printed
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { printedAt: new Date() }
    });
    
    res.json({ success: true, invoice: updatedInvoice });
  } catch (error) {
    console.error('Error marking invoice as printed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
