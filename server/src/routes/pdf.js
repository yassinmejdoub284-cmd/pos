const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    }
  }
});

/**
 * Parse PDF and extract table data
 */
router.post('/parse', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier PDF fourni'
      });
    }

    // Parse PDF content
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // Extract table data from PDF text
    const tableData = extractTableFromText(text);

    res.json({
      success: true,
      data: tableData,
      pages: pdfData.numpages,
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('PDF parsing error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du parsing du PDF: ' + error.message
    });
  }
});

/**
 * Extract table data from PDF text
 */
function extractTableFromText(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Find table headers (usually contain common column names)
  const headerPatterns = [
    /date/i, /famille/i, /article/i, /désignation/i, /quantité/i, /qty/i,
    /prix/i, /htva/i, /ttc/i, /tva/i, /total/i
  ];

  let headers = [];
  let dataRows = [];
  let extractedDate = null;

  // Try to find headers
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    
    // Check if this line contains our expected headers
    if (line.includes('Date') && line.includes('Famille') && line.includes('Article')) {
      // Split by multiple spaces or tabs
      const words = line.split(/\s{2,}|\t+/);
      headers = words.filter(word => word.trim());
      dataRows = lines.slice(i + 1);
      break;
    }
    
    // Fallback: check if this line looks like headers
    const words = line.split(/\s+/);
    const headerCount = words.filter(word => 
      headerPatterns.some(pattern => pattern.test(word))
    ).length;

    if (headerCount >= 3) {
      headers = words;
      dataRows = lines.slice(i + 1);
      break;
    }
  }

  // If no headers found, try to extract from first few lines
  if (headers.length === 0) {
    const firstLine = lines[0];
    headers = firstLine.split(/\s+/).slice(0, 8); // Limit to 8 columns
    dataRows = lines.slice(1);
  }

  // Extract date from text
  const dateMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
  if (dateMatch) {
    extractedDate = dateMatch[1];
  }

  // Process data rows
  const rows = dataRows
    .filter(line => line.trim() && !line.match(/^\s*[-=]+\s*$/) && !line.includes('Total')) // Remove separator lines and totals
    .slice(0, 50) // Limit to 50 rows
    .map(line => {
      // Split by multiple spaces or tabs, same as headers
      const values = line.split(/\s{2,}|\t+/).filter(val => val.trim());
      const rowData = {};
      
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });
      
      return {
        rawData: rowData
      };
    });

  // Calculate totals if possible
  let totalHT = 0;
  let totalTVA = 0;
  let totalTTC = 0;

  try {
    rows.forEach(row => {
      const ttcValue = parseFloat(row.rawData['PV TTC'] || row.rawData['TTC'] || '0');
      const htValue = parseFloat(row.rawData['PV HTVA'] || row.rawData['HTVA'] || '0');
      const qtyValue = parseFloat(row.rawData['Quantité'] || row.rawData['Qty'] || '1');
      
      if (ttcValue > 0) {
        totalTTC += ttcValue * qtyValue;
        if (htValue > 0) {
          totalHT += htValue * qtyValue;
          totalTVA += (ttcValue - htValue) * qtyValue;
        }
      }
    });
  } catch (error) {
    console.error('Error calculating totals:', error);
  }

  return {
    headers: headers.filter(h => h.trim()),
    rows,
    extractedDate,
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100
  };
}

module.exports = router;
