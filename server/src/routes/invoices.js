const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const router = express.Router();

// Configure multer for PDF uploads (memory storage for PDF parsing)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// GET /api/invoices - List all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, clientId, startDate, endDate } = req.query;
    const companyId = req.user.companyId;

    const where = {
      companyId: companyId
    };

    if (status) where.status = status;
    if (clientId) where.clientId = parseInt(clientId);
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: true,
        lines: {
          include: {
            product: true
          }
        }
      },
      orderBy: { invoiceNumber: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.invoice.count({ where });

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/invoices/requests/pending - Get pending invoice requests
router.get('/requests/pending', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    // Get pending invoice requests (you can adjust the query based on your schema)
    const pendingRequests = await prisma.stockDocument.findMany({
      where: {
        companyId: companyId,
        type: 'FACTURE',
        status: 'PREPARED'
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      data: pendingRequests 
    });
  } catch (error) {
    console.error('Error fetching pending invoice requests:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/invoices/latest-date - Get the latest invoice date
router.get('/latest-date', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;


    // Get the latest invoice date from stock documents with type FACTURE
    const latestStockDoc = await prisma.stockDocument.findFirst({
      where: {
        companyId: companyId,
        type: 'FACTURE'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        numero: true
      }
    });

    if (!latestStockDoc) {
      // No invoices found, return null to allow any date
      return res.json({ 
        success: true, 
        data: { latestDate: null } 
      });
    }

    const latestDate = latestStockDoc.createdAt.toISOString().split('T')[0];

    res.json({ 
      success: true, 
      data: { latestDate: latestDate } 
    });
  } catch (error) {
    console.error('Error fetching latest invoice date:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/invoices/:id - Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;


    // Validate that id is a valid integer
    const invoiceId = parseInt(id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const invoice = await prisma.stockDocument.findFirst({
      where: {
        id: invoiceId,
        companyId: companyId,
        type: 'FACTURE'
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      clientId,
      notes,
      items,
      invoiceDate,
      reference
    } = req.body;

    // Use sequential invoice number from reference field
    let document;
    
    try {
      // Create stock document with the sequential number from reference
      document = await prisma.stockDocument.create({
        data: {
          numero: reference, // Use the sequential number passed from frontend
          type: 'FACTURE',
          status: 'PREPARED',
          companyId: companyId,
          clientId: clientId,
          notes: notes,
          createdAt: invoiceDate ? new Date(invoiceDate) : new Date()
        }
      });
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('numero')) {
        // If the sequential number already exists, generate a fallback
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const fallbackNumber = `FAC-${new Date().getFullYear()}-${timestamp}-${randomSuffix}`;
        
        document = await prisma.stockDocument.create({
          data: {
            numero: fallbackNumber,
            type: 'FACTURE',
            status: 'PREPARED',
            companyId: companyId,
            clientId: clientId,
            notes: notes,
            createdAt: invoiceDate ? new Date(invoiceDate) : new Date()
          }
        });
      } else {
        throw error;
      }
    }

    // Create document items
    let subtotalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }

      const montantHT = item.quantity * product.prix_vente_TTC / (1 + product.tva / 100);
      const montantTVA = montantHT * (product.tva / 100);
      const montantTTC = montantHT + montantTVA;

      subtotalHT += montantHT;
      totalTVA += montantTVA;
      totalTTC += montantTTC;

      await prisma.stockDocumentItem.create({
        data: {
          documentId: document.id,
          productId: item.productId,
          famille: product.familleId.toString(),
          quantity: item.quantity,
          montantHT: montantHT,
          montantTTC: montantTTC,
          montantTVA: montantTVA,
          prixUnitaire: product.prix_vente_TTC,
          tva: product.tva
        }
      });
    }

    // Update the stock document with invoice totals and status
    const updatedDocument = await prisma.stockDocument.update({
      where: { id: document.id },
      data: {
        status: 'COMPLETED'
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.status(201).json({ success: true, data: updatedDocument });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.invoiceNumber;
    delete updateData.documentId;
    delete updateData.companyId;
    delete updateData.createdAt;

    const invoice = await prisma.stockDocument.updateMany({
      where: {
        id: parseInt(id),
        companyId: companyId
      },
      data: updateData
    });

    if (invoice.count === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, message: 'Invoice updated successfully' });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    // Check if invoice exists and belongs to company
    const invoice = await prisma.stockDocument.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Delete related records first
    await prisma.stockDocumentPayment.deleteMany({
      where: { invoiceId: parseInt(id) }
    });

    await prisma.stockDocument.delete({
      where: { id: parseInt(id) }
    });

    // Delete the associated stock document
    await prisma.stockDocumentItem.deleteMany({
      where: { documentId: invoice.id }
    });

    await prisma.stockDocument.delete({
      where: { id: invoice.id }
    });

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/invoices/:id/payments - Add payment to invoice
router.post('/:id/payments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;
    const { amount, paymentMethod, bankId, referenceNumber, notes } = req.body;

    // Get invoice
    const invoice = await prisma.stockDocument.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Create payment
    const payment = await prisma.stockDocumentPayment.create({
      data: {
        invoiceId: parseInt(id),
        amount: parseFloat(amount),
        paymentMethod: paymentMethod,
        bankId: bankId || null,
        referenceNumber: referenceNumber,
        notes: notes
      }
    });

    // Update invoice paid amount
    const totalPaid = await prisma.stockDocumentPayment.aggregate({
      where: { invoiceId: parseInt(id) },
      _sum: { amount: true }
    });

    const newPaidAmount = totalPaid._sum.amount || 0;
    const newRemainingAmount = invoice.totalTTC - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'PAID' : invoice.status;

    await prisma.stockDocument.update({
      where: { id: parseInt(id) },
      data: {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus
      }
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/invoices/extracts - Get invoice extracts/reports
router.get('/extracts', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate } = req.query;

    const where = { companyId };
    if (startDate && endDate) {
      where.extractDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const extracts = await prisma.stockDocumentExtract.findMany({
      where,
      include: {
        invoice: {
          include: {
            client: true
          }
        }
      },
      orderBy: { extractDate: 'desc' }
    });

    res.json({ success: true, data: extracts });
  } catch (error) {
    console.error('Error fetching extracts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/invoices/import-pdf - Parse PDF and return data directly (no draft creation)
router.post('/import-pdf', authenticateToken, upload.single('pdf'), async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file provided' });
    }

    // Parse PDF content
    const pdfData = await pdfParse(Buffer.from(req.file.buffer));
    const text = pdfData.text;

    console.log('=== PDF EXTRACTED TEXT ===');
    console.log('Text length:', text.length);
    console.log('First 1000 characters:', text.substring(0, 1000));
    console.log('=== END PDF TEXT ===');

    // Extract table data from PDF text
    const tableData = extractTableFromText(text);

    // Process PDF data into invoice lines
    const invoiceLines = processPDFDataToInvoiceLines(tableData);

    // Calculate totals
    const totals = calculateInvoiceTotals(invoiceLines);

    // Return parsed data directly without creating draft
    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        extractedDate: tableData.extractedDate,
        items: invoiceLines,
        totals: {
          subtotalHT: totals.subtotalHTVA,
          totalTVA: totals.totalTVA,
          totalTTC: totals.totalTTC
        },
        isExtraitJournaliere: tableData.isExtraitJournaliere || false
      }
    });
  } catch (error) {
    console.error('Error importing PDF:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'analyse du PDF',
      error: error.message 
    });
  }
});

// POST /api/invoices/create-from-import - Create invoice from imported data
router.post('/create-from-import', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { clientId, items, notes, invoiceDate } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    // Generate invoice number
    const invoiceCount = await prisma.stockDocument.count({
      where: { 
        type: 'FACTURE',
        companyId: companyId
      }
    });
    const sequentialNumber = String(invoiceCount + 1).padStart(6, '0');
    const invoiceNumber = `FAC-${sequentialNumber}`;

    // Create stock document
    const document = await prisma.stockDocument.create({
      data: {
        numero: invoiceNumber,
        type: 'FACTURE',
        status: 'COMPLETED',
        companyId: companyId,
        clientId: clientId || null,
        notes: notes || 'Importé depuis PDF',
        createdAt: invoiceDate ? new Date(invoiceDate) : new Date()
      }
    });

    // Create document items
    for (const item of items) {
      // Find or create product family
      let famille = await prisma.productFamily.findFirst({
        where: {
          name: item.familleName || 'Marchandise',
          companyId: companyId
        }
      });

      if (!famille) {
        famille = await prisma.productFamily.create({
          data: {
            name: item.familleName || 'Marchandise',
            description: `Famille pour ${item.familleName || 'Marchandise'}`,
            color: '#3b82f6',
            companyId: companyId
          }
        });
      }

      // Find or create product
      let product = await prisma.product.findFirst({
        where: {
          name: item.productName,
          familleId: famille.id,
          companyId: companyId
        }
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: item.productName,
            prix_vente_TTC: item.prixVenteTTC,
            tva: item.tvaPercent,
            designation_legale: item.productName,
            companyId: companyId,
            familleId: famille.id
          }
        });
      }

      // Create document item
      await prisma.stockDocumentItem.create({
        data: {
          documentId: document.id,
          productId: product.id,
          famille: item.familleName || 'Marchandise',
          quantity: item.quantity,
          montantHT: item.prixVenteHTVA * item.quantity,
          montantTTC: item.sousTotalTTC,
          montantTVA: item.montantTVA * item.quantity,
          prixUnitaire: item.prixVenteTTC,
          tva: item.tvaPercent
        }
      });
    }

    // Reload document with items
    const invoiceWithItems = await prisma.stockDocument.findUnique({
      where: { id: document.id },
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.status(201).json({ success: true, data: invoiceWithItems });
  } catch (error) {
    console.error('Error creating invoice from import:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la création de la facture',
      error: error.message 
    });
  }
});

// GET /api/invoices/drafts - Get temporary invoice drafts
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const drafts = await prisma.tempInvoiceDraft.findMany({
      where: { companyId },
      include: {
        client: true,
        lines: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: drafts });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/invoices/drafts/:id/convert - Convert draft to real invoice
router.post('/drafts/:id/convert', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const draft = await prisma.tempInvoiceDraft.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId
      },
      include: {
        lines: true
      }
    });

    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    // Generate invoice number using the same pattern as other documents
    const invoiceCount = await prisma.stockDocument.count({
      where: { 
        type: 'FACTURE',
        companyId: companyId
      }
    });
    const sequentialNumber = String(invoiceCount + 1).padStart(6, '0');
    const invoiceNumber = `FAC-${sequentialNumber}`;

    // Create stock document
    const document = await prisma.stockDocument.create({
      data: {
        numero: invoiceNumber,
        type: 'FACTURE',
        status: 'PREPARED',
        companyId: companyId,
        clientId: draft.clientId,
        notes: draft.notes
      }
    });

    // Create document items from draft lines
    for (const line of draft.lines) {
      // First, find or create a product family
      let famille = await prisma.productFamily.findFirst({
        where: {
          name: line.familleName || 'Marchandise'
        }
      });

      if (!famille) {
        // Create a new product family if it doesn't exist
        famille = await prisma.productFamily.create({
          data: {
            name: line.familleName || 'Marchandise',
            description: `Famille pour ${line.familleName || 'Marchandise'}`,
            color: '#3b82f6',
            company: {
              connect: { id: companyId }
            }
          }
        });
      }

      // Then, create or find a product for this line
      let product = await prisma.product.findFirst({
        where: {
          name: line.productName,
          familleId: famille.id
        }
      });

      if (!product) {
        // Create a new product if it doesn't exist
        product = await prisma.product.create({
          data: {
            name: line.productName,
            prix_vente_TTC: line.prixVenteTTC,
            tva: line.tvaPercent,
            designation_legale: line.productName,
            company: {
              connect: { id: companyId }
            },
            famille: {
              connect: { id: famille.id }
            }
          }
        });
      }

      await prisma.stockDocumentItem.create({
        data: {
          document: {
            connect: { id: document.id }
          },
          product: {
            connect: { id: product.id }
          },
          famille: line.familleName || 'Marchandise',
          quantity: line.quantity,
          montantHT: line.prixVenteHTVA,
          montantTTC: line.sousTotalTTC,
          montantTVA: line.montantTVA,
          prixUnitaire: line.prixVenteTTC,
          tva: line.tvaPercent
        }
      });
    }

    // Delete the draft
    await prisma.tempInvoiceDraft.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, data: document });
  } catch (error) {
    console.error('Error converting draft:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete a draft
router.delete('/drafts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;

    const draft = await prisma.tempInvoiceDraft.findFirst({
      where: {
        id: parseInt(id),
        companyId: companyId
      }
    });

    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    // Delete the draft and its lines
    await prisma.tempInvoiceDraft.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Draft deleted successfully' });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Parse "Extrait Journalière" PDF format
 * Categories are ALL-CAPS headers, each followed by product lines:
 *   PRODUCT NAME  qty  unit_price DT  total DT
 */
function parseExtraitJournaliere(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let extractedDate = null;
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) extractedDate = dateMatch[1];

  const rows = [];
  let currentCategory = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip financial summary block
    if (/RÉSUMÉ FINANCIER/i.test(line)) break;

    // Skip column header line
    if (/^Article\s+Qty\s+Unit Price\s+Total$/i.test(line)) continue;

    // Skip "Total CATEGORY x.xxx DT" lines
    if (/^Total\s+.+?\s+[\d\.,]+\s*DT\s*$/i.test(line)) {
      currentCategory = null;
      continue;
    }

    // Detect ALL-CAPS category header (no decimal numbers)
    if (/^[A-Z0-9\s\-\/]+$/.test(line) && !/\d{1,3}\.\d{3}/.test(line) && line.length > 1) {
      currentCategory = line.trim();
      continue;
    }

    // Parse product line: NAME  qty  unit_price DT  total DT
    const m = line.match(/^(.+?)\s+([\d\.,]+)\s+([\d\.,]+)\s*DT\s+([\d\.,]+)\s*DT\s*$/);
    if (m) {
      rows.push({
        rawData: {
          'Article':    m[1].trim(),
          'Famille':    currentCategory || 'Marchandise',
          'Qty':        m[2].replace(',', '.'),
          'Unit Price': m[3].replace(',', '.'),
          'Total':      m[4].replace(',', '.')
        }
      });
    }
  }

  const totalTTC = rows.reduce((s, r) => s + parseFloat(r.rawData['Total'] || 0), 0);
  return {
    headers: ['Article', 'Famille', 'Qty', 'Unit Price', 'Total'],
    rows,
    extractedDate,
    totalHT:  Math.round(totalTTC / 1.19 * 100) / 100,
    totalTVA: Math.round((totalTTC - totalTTC / 1.19) * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
    isExtraitJournaliere: true
  };
}

/**
 * Parse concatenated row data from PDF format (legacy fallback)
 * Format: "Article + Qty + Unit Price + Total"
 * Example: "JUS 1L FRUIT LOCAL379,000 TND333,000 TND"
 */
function parseConcatenatedRow(line) {
  // Pattern: Article + Qty + Unit Price + Total
  // Examples:
  // "CHAHRAZED 350 GR AM1.0008.000 DT8.000 DT" → Article="CHAHRAZED 350 GR AM", Qty=1.000, Unit Price=8.000, Total=8.000
  // "CHAHRAZED 800 GR AM1.00015.000 DT15.000 DT" → Article="CHAHRAZED 800 GR AM", Qty=1.000, Unit Price=15.000, Total=15.000
  
  console.log('Parsing line:', line);
  
  // Strategy: Look for " DT" markers which indicate price values
  // Pattern: [Product Name][Qty][Unit Price] DT[Total] DT
  
  // Find all occurrences of numbers followed by " DT"
  const dtMatches = [...line.matchAll(/(\d+(?:[.,]\d+)?)\s*DT/gi)];
  
  if (dtMatches.length >= 2) {
    // Last two " DT" values are Unit Price and Total
    const totalMatch = dtMatches[dtMatches.length - 1];
    const unitPriceMatch = dtMatches[dtMatches.length - 2];
    
    const total = totalMatch[1].replace(',', '.');
    const unitPrice = unitPriceMatch[1].replace(',', '.');
    
    // Everything before the unit price match is product name + quantity
    const beforePrices = line.substring(0, unitPriceMatch.index);
    
    // Find the last number before the unit price (this is the quantity)
    const qtyMatch = beforePrices.match(/(\d+(?:[.,]\d+)?)\s*$/);
    let qty = '1';
    let article = beforePrices.trim();
    
    if (qtyMatch) {
      qty = qtyMatch[1].replace(',', '.');
      // Remove the quantity from the article name
      article = beforePrices.substring(0, qtyMatch.index).trim();
    }
    
    console.log('Parsed with DT markers:', { article, qty, unitPrice, total });
    
    return {
      'Article': article,
      'Qty': qty,
      'Unit Price': unitPrice,
      'Total': total
    };
  }
  
  // Fallback: Find all numbers in the line and work backwards
  const numbers = line.match(/\d+(?:,\d+)*(?:\.\d+)?/g);
  
  if (!numbers || numbers.length < 2) {
    return {
      'Article': line,
      'Qty': '1',
      'Unit Price': '0',
      'Total': '0'
    };
  }
  
  // The last two numbers are typically Unit Price and Total
  let total = numbers[numbers.length - 1];
  let unitPrice = numbers[numbers.length - 2];
  let qty = '1';
  
  // Extract quantity - it's the number before the unit price
  if (numbers.length >= 3) {
    qty = numbers[numbers.length - 3];
  }
  
  // Extract article name by removing the last 3 numbers and cleaning up
  let article = line;
  for (let i = numbers.length - 1; i >= Math.max(0, numbers.length - 3); i--) {
    const lastIndex = article.lastIndexOf(numbers[i]);
    if (lastIndex !== -1) {
      article = article.substring(0, lastIndex) + article.substring(lastIndex + numbers[i].length);
    }
  }
  
  // Clean up article name
  article = article.replace(/\s*TND\s*/gi, ' ').replace(/\s*DT\s*/gi, ' ').trim();
  article = article.replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
  
  console.log('Parsed with fallback:', { article, qty, unitPrice, total });
  
  // Parse numbers (remove commas and convert to float)
  const qtyValue = parseFloat(qty.replace(/,/g, '.'));
  const unitPriceValue = parseFloat(unitPrice.replace(/,/g, '.'));
  const totalValue = parseFloat(total.replace(/,/g, '.'));
  
  return {
    'Article': article,
    'Qty': qtyValue.toString(),
    'Unit Price': unitPriceValue.toString(),
    'Total': totalValue.toString()
  };
}

// Helper to format an integer with thousands separators like 31,990
function formatThousands(n) {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Extract table data from PDF text
 */
function extractTableFromText(text) {
  console.log('=== EXTRACTING TABLE DATA ===');

  // Detect Extrait Journalière format and use dedicated parser
  if (/EXTRAIT JOURNALI[EÈ]RE/i.test(text)) {
    console.log('Detected Extrait Journalière format — using dedicated parser');
    return parseExtraitJournaliere(text);
  }
  
  const lines = text.split('\n').filter(line => line.trim());
  console.log('Total lines found:', lines.length);
  
  // Find table headers - look for the specific ERP-POS format
  const headerPatterns = [
    /produit/i, /famille/i, /qté/i, /qty/i, /quantité/i,
    /prix/i, /unitaire/i, /total/i, /montant/i
  ];

  let headers = [];
  let dataRows = [];
  let extractedDate = null;

  // Try to find headers - look for the specific ERP-POS table format
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i].trim();
    console.log(`Line ${i}:`, line);
    
    // Check for the actual header format: "Article", "Qty", "Unit Price", "Total"
    if (line.includes('Article') && line.includes('Qty') && line.includes('Unit Price') && line.includes('Total')) {
      console.log('Found actual header line:', line);
      // The headers are concatenated without spaces, so we'll use fixed column positions
      headers = ['Article', 'Qty', 'Unit Price', 'Total'];
      dataRows = lines.slice(i + 1);
      break;
    }
    
    // Also check for French headers as fallback
    if (line.includes('Produit') && line.includes('Famille') && line.includes('Qté')) {
      console.log('Found French header line');
      const words = line.split(/\s{2,}|\t+/).filter(word => word.trim());
      headers = words;
      dataRows = lines.slice(i + 1);
      break;
    }
    
    // Alternative: look for lines with multiple expected column names
    const words = line.split(/\s+/);
    const headerCount = words.filter(word => 
      headerPatterns.some(pattern => pattern.test(word))
    ).length;

    if (headerCount >= 3) {
      console.log('Found header line with', headerCount, 'matching patterns');
      headers = words;
      dataRows = lines.slice(i + 1);
      break;
    }
  }

  console.log('Headers found:', headers);
  console.log('Data rows count:', dataRows.length);

  // If no headers found, try to extract from first few lines
  if (headers.length === 0) {
    console.log('No headers found, using first line as headers');
    const firstLine = lines[0];
    headers = firstLine.split(/\s+/).slice(0, 8); // Limit to 8 columns
    dataRows = lines.slice(1);
  }

  // Extract date from text
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) {
    extractedDate = dateMatch[1];
    console.log('Extracted date:', extractedDate);
  }

  // Process data rows - look for lines with numbers (prices/quantities)
  const rows = dataRows
    .filter(line => {
      const trimmed = line.trim();
      // Keep lines that have numbers and aren't separator lines
      return trimmed && 
             !trimmed.match(/^\s*[-=]+\s*$/) && 
             !trimmed.includes('Total') &&
             /\d/.test(trimmed); // Must contain at least one digit
    })
    .slice(0, 50) // Limit to 50 rows
    .map((line, index) => {
      console.log(`Processing row ${index}:`, line);
      
      // Custom parser for concatenated format: "Article + Qty + Unit Price + Total"
      const rowData = parseConcatenatedRow(line);
      
      console.log('Row data:', rowData);
      return {
        rawData: rowData
      };
    });

  console.log('Processed rows:', rows.length);

  // Calculate totals if possible
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  try {
    rows.forEach((row, index) => {
      console.log(`Calculating totals for row ${index}:`, row.rawData);
      
      // Try different possible column names for prices and quantities
      // Match actual format: "Article", "Qty", "Unit Price", "Total"
      const ttcValue = parseFloat(
        row.rawData['Total'] || 
        row.rawData['total'] || 
        row.rawData['TOTAL'] ||
        '0'
      );
      
      const unitPriceValue = parseFloat(
        row.rawData['Unit Price'] || 
        row.rawData['unit price'] || 
        row.rawData['UnitPrice'] ||
        row.rawData['unitprice'] ||
        '0'
      );
      
      const qtyValue = parseFloat(
        row.rawData['Qty'] || 
        row.rawData['qty'] || 
        row.rawData['QTY'] ||
        '1'
      );
      
      console.log(`Row ${index} values - TTC: ${ttcValue}, UnitPrice: ${unitPriceValue}, Qty: ${qtyValue}`);
      
      if (ttcValue > 0) {
        // In ERP-POS format, Total is already the line total (quantity * unit price)
        totalTTC += ttcValue;
        // Calculate HT from TTC (assuming 19% VAT)
        const htValue = ttcValue / 1.19;
        totalHT += htValue;
        totalTVA += ttcValue - htValue;
      } else if (unitPriceValue > 0 && qtyValue > 0) {
        // If we have unit price and quantity, calculate total
        const calculatedTotal = unitPriceValue * qtyValue;
        totalTTC += calculatedTotal;
        const htValue = calculatedTotal / 1.19;
        totalHT += htValue;
        totalTVA += calculatedTotal - htValue;
      }
    });
  } catch (error) {
    console.error('Error calculating totals:', error);
  }

  console.log('Final totals - HT:', totalHT, 'TVA:', totalTVA, 'TTC:', totalTTC);
  console.log('=== END TABLE EXTRACTION ===');

  return {
    headers: headers.filter(h => h.trim()),
    rows,
    extractedDate,
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100
  };
}

/**
 * Process PDF data into invoice lines
 */
function processPDFDataToInvoiceLines(pdfData) {
  const lines = [];

  pdfData.rows.forEach((row, index) => {
    // Skip rows with zero or missing quantity
    const quantity = parseFloat(
      row.rawData['Qty'] || 
      row.rawData['qty'] || 
      row.rawData['QTY'] ||
      '0'
    );
    if (quantity <= 0) return;

    // Match actual format: "Article", "Qty", "Unit Price", "Total"
    const productName = row.rawData['Article'] || row.rawData['article'] || `Article ${index + 1}`;
    const famille = row.rawData['Famille'] || row.rawData['famille'] || 'Marchandise';
    const designationLegale = productName; // Use product name as legal designation
    
    // Extract prices from actual format (values are in millimes: e.g., 14,000 => 14000)
    const prixUnitaireMm = parseFloat(
      row.rawData['Unit Price'] || 
      row.rawData['unit price'] || 
      row.rawData['UnitPrice'] ||
      row.rawData['unitprice'] ||
      '0'
    );
    
    const totalTTCMm = parseFloat(
      row.rawData['Total'] || 
      row.rawData['total'] || 
      row.rawData['TOTAL'] ||
      '0'
    );

    // PDF prices are already in TND — no millimes conversion needed
    // Determine final unit price and line total
    let finalUnitTND = prixUnitaireMm;   // already TND
    let sousTotalTNDTTC = totalTTCMm;    // already TND

    if (prixUnitaireMm > 0 && totalTTCMm === 0) {
      // Have unit price, no total — calculate total
      sousTotalTNDTTC = prixUnitaireMm * quantity;
    } else if (totalTTCMm > 0 && prixUnitaireMm === 0) {
      // Have total, no unit price — derive unit price
      finalUnitTND = totalTTCMm / (quantity || 1);
    } else if (totalTTCMm > 0 && prixUnitaireMm > 0) {
      // Both present — trust the total, derive unit price from it
      sousTotalTNDTTC = totalTTCMm;
      finalUnitTND = totalTTCMm / (quantity || 1);
    } else {
      // No price info — skip
      return;
    }

    // Calculate HT and TVA (assuming 19% VAT)
    const tvaPercent = 19;
    const finalPrixHTVA = sousTotalTNDTTC / (1 + tvaPercent / 100);
    const montantTVA = sousTotalTNDTTC - finalPrixHTVA;

    lines.push({
      productName: productName,
      familleName: famille,
      legalDesignation: designationLegale,
      quantity,
      prixVenteHTVA: Math.round(finalPrixHTVA * 100) / 100,
      prixVenteTTC: Math.round(finalUnitTND * 100) / 100,
      tvaPercent: tvaPercent,
      montantTVA: Math.round(montantTVA * 100) / 100,
      sousTotalTTC: Math.round(sousTotalTNDTTC * 100) / 100
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