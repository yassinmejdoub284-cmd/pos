const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { sendPushToAll } = require('../lib/push');
// PDF service removed - using HTML print instead

const router = express.Router();

// Helper function to calculate HTVA and TVA from TTC
function calculateHTVAAndTVA(prixTTC, tvaPercent) {
  const prixHTVA = prixTTC / (1 + tvaPercent / 100);
  const montantTVA = prixTTC - prixHTVA;
  return {
    prixHTVA: Math.round(prixHTVA * 100) / 100,
    montantTVA: Math.round(montantTVA * 100) / 100
  };
}

// Helper function to get next invoice number with atomic increment
async function getNextInvoiceNumber(depotId) {
  try {
    // Use a more robust approach with timestamp + random component
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // Format: FAC-YYMMDD-XXXXXX-XXX (e.g., FAC-250125-123456-789)
    return `FAC-${year}${month}${day}-${timestamp}-${random}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Ultimate fallback
    return `FAC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, source } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    const where = {
      depotId: req.user.depotId
    };
    
    // Validate enums to avoid Prisma enum errors
    const allowedStatus = ['DRAFT', 'ISSUED', 'CANCELLED'];
    const allowedSource = ['DAILY_EXTRACT', 'TICKET_REQUEST'];

    if (typeof status === 'string' && allowedStatus.includes(status)) {
      where.status = status;
    } else {
      // Exclude rows with invalid stored enum values
      where.status = { in: allowedStatus };
    }
    if (typeof source === 'string' && allowedSource.includes(source)) {
      where.source = source;
    } else {
      // Exclude rows with invalid stored enum values
      where.source = { in: allowedSource };
    }
    
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
        take: limitNum
      }),
      prisma.invoice.count({ where })
    ]);
    
    res.json({
      invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
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
    // Guard against missing Prisma model (client not regenerated)
    if (!prisma || !prisma.invoiceRequest || typeof prisma.invoiceRequest.findMany !== 'function') {
      console.warn('Prisma model invoiceRequest is not available; returning empty list');
      return res.json({ requests: [] });
    }

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

// Get invoice by ID (must be after specific routes)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const { depotId } = req.query;
    // Enforce depot isolation - use user's depot, visiting depot, or provided depot
    const userDepotId = req.user?.depotId;
    const visitingDepotHeader = req.headers['x-depot-id'];
    const visitingDepotId = visitingDepotHeader ? parseInt(visitingDepotHeader) : null;
    const targetDepotId = depotId ? parseInt(depotId) : (visitingDepotId || userDepotId);
    
    // For non-admin users, check depot access
    if (req.user?.role !== 'ADMIN' && targetDepotId && userDepotId && targetDepotId !== userDepotId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other depot invoices' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        ...(targetDepotId ? { depotId: targetDepotId } : (req.user?.role === 'ADMIN' ? {} : { depotId: userDepotId }))
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
      status = 'DRAFT',
      companyId
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
    
    // Determine issuing company info
    const depot = await prisma.depot.findUnique({ where: { id: req.user.depotId } });
    const appSettings = await prisma.appSettings.findFirst();
    const company = companyId
      ? await prisma.company.findUnique({ where: { id: Number(companyId) } })
      : null;
    
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
    
    // Create invoice with retry logic for uniqueness
    let invoice;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            status: status,
            source: 'TICKET_REQUEST',
            issueDate: new Date(),
            companyName: company?.raisonSociale || appSettings?.companyName || depot.name,
            companyAddress: company?.adresse || depot.address,
            companyMatricule: company?.matriculeFiscal || appSettings?.companyMatricule,
            customerName: `${client.firstName} ${client.lastName}`,
            customerAddress: client.address,
            customerMatricule: client.matricule,
            subtotalHTVA,
            totalTVA,
            totalTTC,
            depotId: req.user.depotId,
            clientId: client.id,
            companyId: company?.id || null,
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
        break; // Success, exit the retry loop
      } catch (error) {
        if (error.code === 'P2002' && error.meta?.target === 'invoices_invoice_number_key') {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Failed to create invoice after multiple attempts due to duplicate invoice numbers');
          }
          // Generate a new invoice number and try again
          invoiceNumber = await getNextInvoiceNumber(req.user.depotId);
          console.log(`Retrying with new invoice number: ${invoiceNumber}`);
        } else {
          throw error; // Re-throw non-uniqueness errors
        }
      }
    }

    // Add additional fields that the frontend expects
    invoice.numero = invoice.invoiceNumber;
    invoice.createdAt = invoice.issueDate;
    
    // Send push notification for new invoice
    try {
      await sendPushToAll({
        title: 'Nouvelle Facture',
        body: `Facture ${invoice.invoiceNumber} - ${invoice.totalAmount} DT par ${req.user.firstName} ${req.user.lastName}`,
        data: { type: 'INVOICE', id: invoice.id, depotId: invoice.depotId }
      });
    } catch (e) {
      console.warn('[invoices.create] Failed to send push notification:', e);
    }
    
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
      notes,
      companyId
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
    
    // Determine issuing company info
    const appSettings = await prisma.appSettings.findFirst();
    const depot = await prisma.depot.findUnique({ where: { id: req.user.depotId } });
    const company = companyId
      ? await prisma.company.findUnique({ where: { id: Number(companyId) } })
      : null;
    
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
        companyName: company?.raisonSociale || appSettings?.companyName || depot.name,
        companyAddress: company?.adresse || depot.address,
        companyMatricule: company?.matriculeFiscal || appSettings?.companyMatricule,
        customerName: customerInfo.name,
        customerAddress: customerInfo.address,
        customerMatricule: customerInfo.matricule,
        subtotalHTVA,
        totalTVA,
        totalTTC,
        depotId: req.user.depotId,
        clientId: customerInfo.clientId || null,
        companyId: company?.id || null,
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
    if (!prisma || !prisma.invoiceRequest || typeof prisma.invoiceRequest.findMany !== 'function') {
      console.warn('Prisma model invoiceRequest is not available; returning empty list');
      return res.json([]);
    }

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
    if (!prisma || !prisma.invoiceRequest) {
      return res.status(503).json({ error: 'Invoice request model unavailable' });
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
    
    // Get app settings for company info (fallback)
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
        companyId: null,
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
    if (!prisma || !prisma.invoiceRequest) {
      return res.status(503).json({ error: 'Invoice request model unavailable' });
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

// Temporary Invoice Draft Routes

/**
 * Create a temporary invoice draft from PDF data
 */
router.post('/temp-draft', authenticateToken, async (req, res) => {
  try {
    const { pdfData, customerInfo, invoiceDate, notes, sourceFilename } = req.body;

    if (!pdfData || !customerInfo || !invoiceDate) {
      return res.status(400).json({
        error: 'Données manquantes: pdfData, customerInfo et invoiceDate sont requis'
      });
    }

    // Get next invoice number
    let invoiceNumber;
    try {
      invoiceNumber = await getNextInvoiceNumber(req.user.depotId);
    } catch (error) {
      // If no series available, use temporary number
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.getTime().toString().slice(-4);
      invoiceNumber = `DRAFT-${dateStr}-${timeStr}`;
    }

    // Process PDF data into invoice lines
    const invoiceLines = processPDFDataToInvoiceLines(pdfData);

    // Calculate totals
    const totals = calculateInvoiceTotals(invoiceLines);

    // Create temporary invoice draft
    const tempDraft = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber,
      customerId: customerInfo.customerId,
      customerName: customerInfo.customerName,
      customerAddress: customerInfo.customerAddress,
      customerMatricule: customerInfo.customerMatricule,
      date: invoiceDate,
      notes: notes || '',
      lines: invoiceLines,
      totals,
      status: invoiceNumber.startsWith('DRAFT-') ? 'Needs Number' : 'Numbered',
      sourceFilename,
      createdAt: new Date().toISOString(),
      isTemporary: true
    };

    // TODO: Store in database or temporary storage
    // For now, we'll return the draft object
    // In a real implementation, you'd save this to a temp_drafts table

    res.json(tempDraft);

  } catch (error) {
    console.error('Error creating temp invoice draft:', error);
    res.status(500).json({
      error: 'Erreur lors de la création du brouillon temporaire'
    });
  }
});

/**
 * Get all temporary invoice drafts
 */
router.get('/temp-drafts', authenticateToken, async (req, res) => {
  try {
    // TODO: Fetch from database
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching temp drafts:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des brouillons'
    });
  }
});

/**
 * Delete a temporary invoice draft
 */
router.delete('/temp-drafts/:draftId', authenticateToken, async (req, res) => {
  try {
    const { draftId } = req.params;

    // TODO: Delete from database
    // For now, just return success
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting temp draft:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression du brouillon'
    });
  }
});

/**
 * Finalize a temporary invoice draft (convert to real invoice)
 */
router.post('/finalize-draft', authenticateToken, async (req, res) => {
  try {
    const { draftId } = req.body;

    if (!draftId) {
      return res.status(400).json({
        error: 'ID du brouillon requis'
      });
    }

    // TODO: Implement actual finalization logic
    // This would typically:
    // 1. Fetch the temp draft from database
    // 2. Create a real invoice with the draft data
    // 3. Assign proper invoice number if needed
    // 4. Create invoice lines
    // 5. Update stock if needed
    // 6. Delete the temp draft
    // 7. Return the created invoice

    // For now, simulate success
    console.log(`Finalizing draft: ${draftId}`);
    
    res.json({ 
      success: true, 
      message: 'Brouillon finalisé avec succès',
      invoiceId: `INV-${Date.now()}`
    });

  } catch (error) {
    console.error('Error finalizing draft:', error);
    res.status(500).json({
      error: 'Erreur lors de la finalisation du brouillon'
    });
  }
});

/**
 * Process PDF data into invoice lines
 */
function processPDFDataToInvoiceLines(pdfData) {
  const lines = [];

  pdfData.rows.forEach((row, index) => {
    // Skip rows with zero or missing quantity
    const quantity = parseFloat(row.rawData['Quantité'] || row.rawData['quantite'] || row.rawData['qty'] || '0');
    if (quantity <= 0) return;

    const article = row.rawData['Article'] || row.rawData['article'] || row.rawData['designation'] || `Article ${index + 1}`;
    const designationLegale = row.rawData['Désignation légale'] || row.rawData['designation_legale'] || article;
    const famille = row.rawData['Famille'] || row.rawData['famille'] || 'Général';
    
    // Extract prices
    const prixTTC = parseFloat(row.rawData['PV TTC'] || row.rawData['prix_ttc'] || row.rawData['ttc'] || '0');
    const prixHTVA = parseFloat(row.rawData['PV HTVA'] || row.rawData['prix_htva'] || row.rawData['htva'] || '0');
    const tvaPercent = parseFloat(row.rawData['TVA %'] || row.rawData['tva_percent'] || row.rawData['tva'] || '19');

    // Calculate missing values
    let finalPrixTTC = prixTTC;
    let finalPrixHTVA = prixHTVA;
    let finalTvaPercent = tvaPercent;

    if (prixTTC && !prixHTVA) {
      finalPrixHTVA = prixTTC / (1 + tvaPercent / 100);
    } else if (prixHTVA && !prixTTC) {
      finalPrixTTC = prixHTVA * (1 + tvaPercent / 100);
    } else if (!prixTTC && !prixHTVA) {
      // Skip this line if no price information
      return;
    }

    const montantTVA = finalPrixTTC - finalPrixHTVA;
    const sousTotalTTC = finalPrixTTC * quantity;

    lines.push({
      productName: article,
      familleName: famille,
      legalDesignation: designationLegale,
      quantity,
      prixVenteHTVA: Math.round(finalPrixHTVA * 100) / 100,
      prixVenteTTC: Math.round(finalPrixTTC * 100) / 100,
      tvaPercent: finalTvaPercent,
      montantTVA: Math.round(montantTVA * 100) / 100,
      sousTotalTTC: Math.round(sousTotalTTC * 100) / 100
    });
  });

  return lines;
}

/**
 * Calculate totals from invoice lines
 */
function calculateInvoiceTotals(lines) {
  const totals = lines.reduce(
    (acc, line) => ({
      subtotalHTVA: acc.subtotalHTVA + (line.prixVenteHTVA * line.quantity),
      totalTVA: acc.totalTVA + (line.montantTVA * line.quantity),
      totalTTC: acc.totalTTC + line.sousTotalTTC
    }),
    { subtotalHTVA: 0, totalTVA: 0, totalTTC: 0 }
  );

  return {
    subtotalHTVA: Math.round(totals.subtotalHTVA * 100) / 100,
    totalTVA: Math.round(totals.totalTVA * 100) / 100,
    totalTTC: Math.round(totals.totalTTC * 100) / 100
  };
}

module.exports = router;
