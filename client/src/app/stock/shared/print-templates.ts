import { StockDocument } from '../../core/models/stock-document.model';
import { AppSettings } from '../../core/services/settings.service';

export type ScanDocumentType = 'sortie' | 'transfert' | 'livraison';

export function getScanPrintStyles(): string {
  return `
    body {
      font-family: 'Times New Roman', serif;
      margin: 0;
      padding: 20px;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
      background: white;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 20px;
      background: white;
    }
    .header {
      display: flex;
      flex-direction: column;
      margin-bottom: 25px;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
    }
    .company-info { margin-bottom: 15px; }
    .document-info { text-align: left; width: fit-content; border: 1px solid #ccc; border-radius: 8px; padding: 10px; background-color: #f9f9f9; }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .subtitle { font-size: 14px; color: #333; margin-bottom: 10px; font-weight: bold; }
    .info-row { margin: 4px 0; font-size: 12px; line-height: 1.2; }
    .info-section {
      margin: 12px 0;
      padding: 10px;
      background-color: #f8f8f8;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .label { font-weight: bold; display: inline-block; width: 140px; color: #333; vertical-align: top; }
    .value { font-weight: normal; color: #000; display: inline-block; vertical-align: top; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
      border: 2px solid #000;
    }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th {
      background-color: #e0e0e0;
      font-weight: bold;
      text-align: center;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tfoot { border-top: 2px solid #000; }
    .total-row { background-color: #f0f0f0; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .total-breakdown {
      display: flex;
      justify-content: flex-end;
      flex-direction: column;
      align-items: flex-end;
    }
    .total-line { display: flex; justify-content: space-between; width: 300px; margin-bottom: 5px; font-size: 13px; }
    .total-final { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 14px; }
    .footer { margin-top: 40px; border-top: 2px solid #000; padding-top: 20px; }
    .signature-section { margin-bottom: 20px; }
    .signature-box { width: 300px; margin: 0 auto; text-align: center; }
    .signature-label { font-weight: bold; margin-bottom: 10px; }
    .signature-line { border-bottom: 1px solid #000; height: 20px; }
    .legal-notice { text-align: center; font-size: 11px; color: #333; margin-top: 20px; }
    .legal-notice p { margin: 5px 0; }
    @media print {
      body { margin: 0; padding: 10px; }
      .container { max-width: none; border: none; padding: 0; }
    }
  `;
}

// Helper function to get absolute logo URL
function getAbsoluteLogoUrl(logoUrl: string | undefined, baseUrl: string = 'https://patisserie.solumove.net'): string {
  if (!logoUrl) return '';
  if (logoUrl.startsWith('http')) return logoUrl;
  
  // If the logo URL starts with /uploads, ensure it's properly formatted
  if (logoUrl.startsWith('/uploads/')) {
    return `${baseUrl}${logoUrl}`;
  }
  
  // For other relative URLs, add the base URL
  return `${baseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
}

// Function to convert number to French words following Tunisian official document rules
function numberToFrenchWords(amount: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const hundreds = ['', 'cent', 'deux cent', 'trois cent', 'quatre cent', 'cinq cent', 'six cent', 'sept cent', 'huit cent', 'neuf cent'];
  
  if (amount === 0) return 'Zéro dinars et 000 millimes.';
  
  let dinars = Math.floor(amount);
  let millimes = Math.round((amount - dinars) * 1000);
  
  let result = '';
  
  // Convert dinars to words
  if (dinars > 0) {
    if (dinars >= 1000) {
      const thousands = Math.floor(dinars / 1000);
      if (thousands === 1) {
        result += 'mille ';
      } else {
        result += convertNumberToWords(thousands) + ' mille ';
      }
      dinars %= 1000;
    }
    
    if (dinars >= 100) {
      const hundred = Math.floor(dinars / 100);
      if (hundred === 1) {
        result += 'cent ';
      } else {
        result += hundreds[hundred] + ' ';
      }
      dinars %= 100;
    }
    
    if (dinars >= 20) {
      const ten = Math.floor(dinars / 10);
      const unit = dinars % 10;
      if (ten === 7 || ten === 9) {
        result += tens[ten] + '-' + units[unit + 10] + ' ';
      } else if (ten === 8 && unit === 0) {
        result += 'quatre-vingts ';
      } else {
        result += tens[ten] + (unit > 0 ? '-' + units[unit] : '') + ' ';
      }
    } else if (dinars > 0) {
      result += units[dinars] + ' ';
    }
    
    result += 'dinars';
  } else {
    result = '000 dinars';
  }
  
  // Add millimes as 3-digit number
  const millimesStr = millimes.toString().padStart(3, '0');
  result += ` et ${millimesStr} millimes.`;
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Helper function to convert numbers to words (recursive)
function convertNumberToWords(num: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const hundreds = ['', 'cent', 'deux cent', 'trois cent', 'quatre cent', 'cinq cent', 'six cent', 'sept cent', 'huit cent', 'neuf cent'];
  
  if (num === 0) return '';
  if (num < 20) return units[num];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    if (ten === 7 || ten === 9) {
      return tens[ten] + '-' + units[unit + 10];
    } else if (ten === 8 && unit === 0) {
      return 'quatre-vingts';
    } else {
      return tens[ten] + (unit > 0 ? '-' + units[unit] : '');
    }
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    if (hundred === 1) {
      return 'cent' + (remainder > 0 ? ' ' + convertNumberToWords(remainder) : '');
    } else {
      return hundreds[hundred] + (remainder > 0 ? ' ' + convertNumberToWords(remainder) : '');
    }
  }
  return '';
}

export function buildScanLikeDocumentHtmlFromDocument(document: StockDocument, sessionType: ScanDocumentType, settings?: AppSettings | null): string {
  const currentDate = new Date().toLocaleDateString('fr-FR');
  const currentTime = new Date().toLocaleTimeString('fr-FR');

  // Unified title based on document type
  const getDocumentTitle = (doc: StockDocument): string => {
    switch (doc.type) {
      case 'BON_EXPEDITION':
        return 'Bon de Sortie';
      case 'BON_TRANSFERT':
        return 'Bon de Transfert';
      case 'BON_ENTREE_MAGASIN':
        return 'Bon de Livraison';
      case 'FACTURE':
        return 'Facture';
      default:
        return 'Document';
    }
  };

  const title = getDocumentTitle(document);

  // Build item rows (with grouping and pricing for ALL document types)
  // Helper: normalize TVA to fraction (0.07 for 7% or 0.07)
  const getTvaRateFraction = (raw: any): number => {
    const n = Number(raw);
    if (!isFinite(n) || n < 0) return 0;
    return n <= 1 ? n : n / 100;
  };
  let itemsRows = '';
  // Unified totals for ALL document types
  let unifiedTotalHT = 0;
  let unifiedTotalTVA = 0;
  let unifiedTotalTTC = 0;
  
  // Group by TVA rates for breakdown table (moved outside block scope)
  const tvaGroups: Record<number, {
    rate: number;
    baseHT: number;
    montantTVA: number;
  }> = {};
  
  // Always process with pricing for all document types
  {
    const isWholesaleClient = !!(document as any).client && ((document as any).client.clientType === 'WHOLESALE');
    
    // Group items by parent product AND TVA rate
    const parentGroups: Record<string, {
      parentName: string;
      tvaRate: number;
      children: Array<{
        childName: string;
        quantity: number;
        count: number;
        montantHT: number;
        montantTVA: number;
        montantTTC: number;
        tvaRate: number;
      }>;
      totalQty: number;
      totalCount: number;
      totalHT: number;
      totalTVA: number;
      totalTTC: number;
    }> = {};
    
    (document.items || []).forEach((raw) => {
      const item: any = raw as any;
      const product = item.product || {};
      
      // Get parent product ID (use parentProductId if available, otherwise use productId)
      const parentId = item.parentProductId || item.productId;
      const childName = item.childProductName || product.name || `CHILDREN ${item.productId}`;
      const parentName = item.famille || product.famille || 'Général';
      
      const qty = Number(item.quantity ?? 0) || 0; // kg
      const cnt = Number(item.count ?? 1) || 0;
      
      // Use item pricing if available, otherwise calculate from product
      let montantHT = Number(item.montantHT) || 0;
      let montantTVA = Number(item.montantTVA) || 0;
      let montantTTC = Number(item.montantTTC) || 0;
      let tvaRate = Number(item.tva) || 0;
      
      // If no item pricing, calculate from product
      if (!montantHT && !montantTVA && !montantTTC) {
        const baseUnit = Number(product.prix_vente_TTC ?? 0) || 0; // TTC
        const bundlePrice = Number(product.bundlePrice ?? 0) || 0;
        const bundleSize = Number(product.bundleSize ?? 0) || 0;
        const canWholesale = !!product.isWholesale && bundleSize > 0 && bundlePrice > 0;
        const unitPriceTTC = isWholesaleClient && canWholesale ? (bundlePrice / bundleSize) : baseUnit;
        const tvaFrac = getTvaRateFraction(product.tva);
        tvaRate = Number(product.tva) || 0;
        montantTTC = unitPriceTTC * qty;
        montantHT = montantTTC / (1 + tvaFrac);
        montantTVA = montantTTC - montantHT;
      }
      
      // Convert TVA rate to percentage if it's a decimal (0.07 -> 7%, 0.19 -> 19%)
      // But keep whole numbers as is (7 -> 7%, 19 -> 19%)
      if (tvaRate > 0 && tvaRate <= 1) {
        tvaRate = tvaRate * 100;
      }
      
      // Create unique group key based on parent product ID and TVA rate
      const groupKey = `${parentId}_${tvaRate}`;
      
      // Initialize parent group if not exists
      if (!parentGroups[groupKey]) {
        parentGroups[groupKey] = {
          parentName,
          tvaRate,
          children: [],
          totalQty: 0,
          totalCount: 0,
          totalHT: 0,
          totalTVA: 0,
          totalTTC: 0
        };
      }
      
      // Add child to parent group
      parentGroups[groupKey].children.push({
        childName,
        quantity: qty,
        count: cnt,
        montantHT,
        montantTVA,
        montantTTC,
        tvaRate
      });
      
      // Update parent totals
      parentGroups[groupKey].totalQty += qty;
      parentGroups[groupKey].totalCount += cnt;
      parentGroups[groupKey].totalHT += montantHT;
      parentGroups[groupKey].totalTVA += montantTVA;
      parentGroups[groupKey].totalTTC += montantTTC;
      
      // accumulate unified totals
      unifiedTotalHT += montantHT;
      unifiedTotalTVA += montantTVA;
      unifiedTotalTTC += montantTTC;
      
      // Group by TVA rate for breakdown table
      if (!tvaGroups[tvaRate]) {
        tvaGroups[tvaRate] = {
          rate: tvaRate,
          baseHT: 0,
          montantTVA: 0
        };
      }
      tvaGroups[tvaRate].baseHT += montantHT;
      tvaGroups[tvaRate].montantTVA += montantTVA;
    });
    
    // Generate rows for each parent group
    const parentEntries = Object.entries(parentGroups);
    itemsRows = parentEntries.map(([groupKey, group], idx) => {
      // Create children details string (only names, no quantities)
      const childrenDetails = group.children
        .map(child => child.childName)
        .join(', ');
      
      // Create designation with parent name and children details (small font)
      const designation = `${group.parentName} <span style="font-size: 8px; color: #666;">(${childrenDetails})</span>`;
      
      return `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${designation}</td>
          <td class="text-center">${(Number(group.totalQty) || 0).toFixed(3)}</td>
          <td class="text-center">${(Number(group.totalHT) || 0).toFixed(3)} DT</td>
          <td class="text-center">${(Number(group.tvaRate) || 0).toFixed(1)}%</td>
          <td class="text-center">${(Number(group.totalTTC) || 0).toFixed(3)} DT</td>
        </tr>
      `;
    }).join('');
  }

  const totalsSection = `
    <tfoot>
      <tr class="total-row">
        <td colspan="3" class="text-right font-bold">TOTAL:</td>
        <td class="text-center font-bold">${(Number(unifiedTotalHT) || 0).toFixed(3)} DT</td>
        <td class="text-center font-bold">-</td>
        <td class="text-center font-bold">${(Number(unifiedTotalTTC) || 0).toFixed(3)} DT</td>
      </tr>
    </tfoot>
  `;

  // Build unified header for ALL document types (like Bon de Livraison)
  const em = (document as any).emetteur || {};
  const dest = (document as any).destinataire || {};
  const company = (em && (em.company)) ? (em.company) : em;
  const companyName = company.raisonSociale || company.name || 'Société';
  const companyForme = company.formeJuridique || company.forme_juridique || '';
  const companyAddress = company.adresse || company.address || '-';
  const companyCity = ''; // do not display city in addresses
  const companyPhone = company.telephone || company.phone || '-';
  const companyEmail = company.email || '';
  const companyMatricule = company.matriculeFiscal || company.matricule_fiscale || '-';
  // Use enterprise (sender company) logo only
  const senderCompanyLogoUrl = (em && em.company && em.company.logoUrl) ? em.company.logoUrl : '';
  const companyLogo = senderCompanyLogoUrl ? getAbsoluteLogoUrl(senderCompanyLogoUrl) : '';

  const client = (document as any).client || (dest && (dest.client || dest.clients?.[0])) || null;
  console.log('Print template - Document client:', (document as any).client);
  console.log('Print template - Dest client:', dest && (dest.client || dest.clients?.[0]));
  console.log('Print template - Final client:', client);
  const clientName = client && client.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : '-';
  const clientAddress = client?.address || '-';
  const clientPhone = client?.phone || '-';
  const clientMatricule = client?.matriculeFiscal || client?.matricule_fiscale || '-';

  const unifiedHeader = `
    <div class="header">
      <div class="company-info">
        ${companyLogo ? `<div style="margin-bottom:8px;"><img src="${companyLogo}" alt="logo" style="max-width:140px; max-height:80px; object-fit:contain;"></div>` : ''}
        <div class="title">${title}</div>
        <div class="subtitle">N° ${document.numero}</div>
        <div class="info-row"><span class="label">Date:</span><span class="value">${currentDate}</span></div>
        <div class="info-row"><span class="label">Société:</span><span class="value">${companyName}</span></div>
        <div class="info-row"><span class="label">Adresse:</span><span class="value">${companyAddress}</span></div>
        <div class="info-row"><span class="label">Téléphone:</span><span class="value">${companyPhone}</span></div>
        <div class="info-row"><span class="label">Matricule fiscale:</span><span class="value">${companyMatricule}</span></div>
      </div>
      <div class="document-info">
        <div class="info-row"><span class="label">Client:</span><span class="value">${clientName}</span></div>
        <div class="info-row"><span class="label">Adresse:</span><span class="value">${clientAddress}</span></div>
        <div class="info-row"><span class="label">Téléphone:</span><span class="value">${clientPhone}</span></div>
        <div class="info-row"><span class="label">Matricule fiscal:</span><span class="value">${clientMatricule}</span></div>
      </div>
    </div>
  `;

  // Build additional info sections based on document type
  const additionalInfo = (() => {
    switch (document.type) {
      case 'BON_EXPEDITION':
        return `
          <div class="info-section">
            <span class="label">Destination:</span>
            <span class="value">${(document as any).destination || 'Non spécifié'}</span>
          </div>
          <div class="info-section">
            <span class="label">Validité du:</span>
            <span class="value">${(document as any).validationFromDate ? new Date((document as any).validationFromDate).toLocaleDateString('fr-FR') : 'Non spécifié'}</span>
            <span class="label" style="margin-left: 20px;">Validité au:</span>
            <span class="value">${(document as any).validationToDate ? new Date((document as any).validationToDate).toLocaleDateString('fr-FR') : 'Non spécifié'}</span>
          </div>
        `;
      case 'BON_TRANSFERT':
        return `
          <div class="info-section">
            <span class="label">De:</span>
            <span class="value">${document.emetteur?.name || 'Non spécifié'}</span>
          </div>
          <div class="info-section">
            <span class="label">Vers:</span>
            <span class="value">${document.destinataire?.name || 'Non spécifié'}</span>
          </div>
        `;
      case 'BON_ENTREE_MAGASIN':
        return ``;
      case 'FACTURE':
        return ``;
      default:
        return '';
    }
  })();

  const tunisianFooter = '';

  return `
    <div class="container">
      ${unifiedHeader}
      ${additionalInfo}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
             <th>Qté</th>
            <th>Montant HT</th>
            <th>TVA</th>
            <th>Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        ${totalsSection}
      </table>

       <div class="totals-and-amount" style="page-break-inside: avoid;">
         <div class="totals-summary" style="display: flex; justify-content: space-between;">
           ${document.type === 'FACTURE' ? `
             <div>
               <table style="width: 200px; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
                 <thead>
                   <tr style="background-color: #f0f0f0;">
                     <th style="border: 1px solid #000; text-align: center;">Taux (%)</th>
                     <th style="border: 1px solid #000; text-align: center;">Base</th>
                     <th style="border: 1px solid #000; text-align: center;">Montant TVA</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${Object.values(tvaGroups)
                     .sort((a: any, b: any) => a.rate - b.rate) // Sort by TVA rate
                     .map((tvaGroup: any) => `
                     <tr>
                       <td style="border: 1px solid #000; text-align: center;">${tvaGroup.rate.toFixed(1)}</td>
                       <td style="border: 1px solid #000; text-align: center;">${tvaGroup.baseHT.toFixed(3)}</td>
                       <td style="border: 1px solid #000; text-align: center;">${tvaGroup.montantTVA.toFixed(3)}</td>
                     </tr>
                   `).join('')}
                 </tbody>
               </table>
             </div>
           ` : ''}
           <div class="total-breakdown">
             <div class="total-line"><span class="label">Total HT:</span><span class="value">${(Number(unifiedTotalHT) || 0).toFixed(3)} DT</span></div>
             <div class="total-line"><span class="label">Total TVA:</span><span class="value">${(Number(unifiedTotalTVA) || 0).toFixed(3)} DT</span></div>
             <div class="total-line total-final"><span class="label">Total TTC:</span><span class="value">${(Number(unifiedTotalTTC) || 0).toFixed(3)} DT</span></div>
           </div>
         </div>

         ${document.type === 'FACTURE' ? `
           <div style="margin-top: 20px; padding: 15px; border: 1px solid #000; background-color: #f9f9f9;">
             <div style="font-size: 10px; line-height: 1.4; color: #666;">
               <span>Arrêté la présente facture, sauf erreur ou omission de notre part, à la somme de :</span><br>
               <span style="font-weight: bold; text-transform: uppercase; color: #000;">${numberToFrenchWords(Number(unifiedTotalTTC) || 0)}</span>
             </div>
           </div>
         ` : ''}
       </div>

      <div class="footer">
        <div class="signature-section" style="display:flex; gap:24px; justify-content:space-between;">
          <div class="signature-box" style="flex:1;">
            <div class="signature-label">Signature et cachet fournisseur</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box" style="flex:1;">
            <div class="signature-label">Signature client</div>
            <div class="signature-line"></div>
          </div>
        </div>
        ${tunisianFooter}
      </div>
    </div>
  `;
}


