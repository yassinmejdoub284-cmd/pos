import { StockDocument } from '../../core/models/stock-document.model';

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
      justify-content: space-between;
      margin-bottom: 25px;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
    }
    .company-info { flex: 1; }
    .document-info { text-align: right; flex: 1; }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .subtitle { font-size: 14px; color: #333; margin-bottom: 10px; font-weight: bold; }
    .info-row { margin: 4px 0; font-size: 12px; }
    .info-section {
      margin: 12px 0;
      padding: 10px;
      background-color: #f8f8f8;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .label { font-weight: bold; display: inline-block; width: 140px; color: #333; }
    .value { font-weight: normal; color: #000; }
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
    .totals-summary {
      margin: 20px 0;
      padding: 15px;
      background-color: #f8f8f8;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
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

export function buildScanLikeDocumentHtmlFromDocument(document: StockDocument, sessionType: ScanDocumentType): string {
  const currentDate = new Date().toLocaleDateString('fr-FR');
  const currentTime = new Date().toLocaleTimeString('fr-FR');

  const title = sessionType === 'sortie' ? 'Bon de sortie' : sessionType === 'transfert' ? 'Bon de transfert' : 'Bon de livraison';

  const itemsRows = (document.items || []).map((item, index) => `
    <tr>
      <td class="text-center">${index + 1}</td>
      <td>${item.product?.name || 'Produit #' + item.productId}</td>
      <td class="text-center">${((Number((item as any).quantity ?? 0) || 0)).toFixed(3)} kg</td>
      <td class="text-center">1</td>
      ${sessionType === 'livraison' ? `
        <td class="text-center">0.000 TND</td>
        <td class="text-center">0.000 TND</td>
        <td class="text-center">0.000 TND</td>
      ` : ''}
    </tr>
  `).join('');

  const totalsSection = sessionType === 'livraison' ? `
    <tfoot>
      <tr class="total-row">
        <td colspan="4" class="text-right font-bold">TOTAL:</td>
        <td class="text-center font-bold">0.000 TND</td>
        <td class="text-center font-bold">0.000 TND</td>
        <td class="text-center font-bold">0.000 TND</td>
      </tr>
    </tfoot>
  ` : '';

  // Build specialized header for Bon de Livraison (invoice-like)
  const em = (document as any).emetteur || {};
  const dest = (document as any).destinataire || {};
  const company = (em && (em.company)) ? (em.company) : em;
  const companyName = company.raisonSociale || company.name || 'Société';
  const companyForme = company.formeJuridique || company.forme_juridique || '';
  const companyAddress = company.adresse || company.address || '';
  const companyCity = company.ville ? `, ${company.ville}` : (company.city ? `, ${company.city}` : '');
  const companyPhone = company.telephone || company.phone || '';
  const companyEmail = company.email || '';
  const companyMatricule = company.matriculeFiscal || company.matricule_fiscale || '';
  const companyLogo = company.logoUrl || company.logo || '';

  const client = (document as any).client || (dest && (dest.client || dest.clients?.[0])) || null;
  const clientName = client && client.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : 'Client non spécifié';
  const clientAddress = client?.address || '';
  const clientMatricule = client?.matriculeFiscal || client?.matricule_fiscale || '';

  const livraisonHeader = `
    <div class="header">
      <div class="company-info">
        <div class="title">FACTURE</div>
        <div class="subtitle">N° ${document.numero}</div>
        <div class="info-row"><span class="label">Date:</span><span class="value">${currentDate}</span></div>
        <div class="info-section">
          <span class="label">Client:</span>
          <span class="value">${clientName}</span>
          ${clientAddress ? `<br><span class="label">Adresse:</span><span class="value">${clientAddress}</span>` : ''}
          ${clientMatricule ? `<br><span class="label">Matricule fiscale:</span><span class="value">${clientMatricule}</span>` : ''}
        </div>
      </div>
      <div class="document-info">
        ${companyLogo ? `<div style="margin-bottom:8px;"><img src="${companyLogo}" alt="logo" style="max-width:140px; max-height:80px; object-fit:contain;"></div>` : ''}
        <div class="info-row"><span class="label">Société:</span><span class="value">${companyName}${companyForme ? ' - ' + companyForme : ''}</span></div>
        ${companyAddress || companyCity ? `<div class="info-row"><span class="label">Adresse:</span><span class="value">${companyAddress}${companyCity}</span></div>` : ''}
        ${companyPhone ? `<div class="info-row"><span class="label">Téléphone:</span><span class="value">${companyPhone}</span></div>` : ''}
        ${companyEmail ? `<div class="info-row"><span class="label">Email:</span><span class="value">${companyEmail}</span></div>` : ''}
        ${companyMatricule ? `<div class="info-row"><span class="label">Matricule fiscale:</span><span class="value">${companyMatricule}</span></div>` : ''}
      </div>
    </div>
  `;

  const defaultHeader = `
    <div class="header">
      <div class="company-info">
        <div class="title">${title.toUpperCase()}</div>
        <div class="subtitle">N° ${document.numero}</div>
      </div>
      <div class="document-info">
        <div class="info-row"><span class="label">Date:</span><span class="value">${currentDate}</span></div>
        <div class="info-row"><span class="label">Heure:</span><span class="value">${currentTime}</span></div>
        ${companyName ? `<div class="info-row"><span class="label">Société:</span><span class="value">${companyName}</span></div>` : ''}
        ${company?.formeJuridique ? `<div class="info-row"><span class="label">Forme juridique:</span><span class="value">${company.formeJuridique}</span></div>` : ''}
        ${company?.adresse || company?.ville ? `<div class="info-row"><span class="label">Adresse:</span><span class="value">${company.adresse || ''}${company.ville ? ', ' + company.ville : ''}</span></div>` : ''}
        ${company?.telephone ? `<div class="info-row"><span class="label">Téléphone:</span><span class="value">${company.telephone}</span></div>` : ''}
        ${company?.email ? `<div class="info-row"><span class="label">Email:</span><span class="value">${company.email}</span></div>` : ''}
        ${company?.matriculeFiscal ? `<div class="info-row"><span class="label">Matricule fiscale:</span><span class="value">${company.matriculeFiscal}</span></div>` : ''}
      </div>
    </div>

    ${sessionType === 'sortie' ? `
      <div class="info-section">
        <span class="label">Destination:</span>
        <span class="value">${(document as any).destination || 'Non spécifié'}</span>
      </div>
      <div class="info-section">
        <span class="label">Validité du:</span>
        <span class="value">${(document as any).validationFromDate ? new Date((document as any).validationFromDate).toLocaleDateString('fr-FR') : 'Non spécifié'}</span>
      </div>
      <div class="info-section">
        <span class="label">Validité au:</span>
        <span class="value">${(document as any).validationToDate ? new Date((document as any).validationToDate).toLocaleDateString('fr-FR') : 'Non spécifié'}</span>
      </div>
    ` : `
      <div class="info-section">
        <span class="label">De:</span>
        <span class="value">${document.emetteur?.name || 'Non spécifié'}</span>
      </div>
      <div class="info-section">
        <span class="label">Vers:</span>
        <span class="value">${document.destinataire?.name || 'Non spécifié'}</span>
      </div>
    `}
  `;

  const headerHtml = sessionType === 'livraison' ? livraisonHeader : defaultHeader;

  const tunisianFooter = '';

  return `
    <div class="container">
      ${headerHtml}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Désignation</th>
            <th>Qté (kg)</th>
            <th>Colis</th>
            ${sessionType === 'livraison' ? `
              <th>Montant HT</th>
              <th>TVA</th>
              <th>Montant TTC</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        ${totalsSection}
      </table>

      ${sessionType === 'livraison' ? `
        <div class="totals-summary">
          <div class="total-breakdown">
            <div class="total-line"><span class="label">Total HT:</span><span class="value">0.000 TND</span></div>
            <div class="total-line"><span class="label">Total TVA:</span><span class="value">0.000 TND</span></div>
            <div class="total-line total-final"><span class="label">Total TTC:</span><span class="value">0.000 TND</span></div>
          </div>
        </div>
      ` : ''}

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


