
export interface TicketData {
    entreprise: {
        nom_entreprise: string;
        adresse: string;
        telephone: string;
    };
    ticketNum: string;
    dateVente: Date;
    patient?: {
        nom_prenoms: string;
        numero_carnet?: string;
        telephone?: string;
        nom_assurance?: string;
        taux_couverture?: number;
    };
    personnel?: {
        nom_prenoms: string;
    };
    caissier: string;
    items: {
        libelle: string;
        categorie?: string;
        qte: number;
        partPatientUnitaire: number;
    }[];
    totalBrut: number;
    totalPartAssureur: number;
    totalNetPatient: number;
    paiement: {
        montantVerse: number;
        rendu: number;
        mode: string;
    };
    insForm?: {
        societeId: string;
        matricule: string;
        numeroBon: string;
        societeNom?: string;
    };
}

export const generateTicketHTML = (data: TicketData, format: '80mm' | 'A4' = '80mm') => {

    const { entreprise, ticketNum, dateVente, patient, personnel, caissier, items, totalBrut, totalPartAssureur, totalNetPatient, paiement, insForm } = data;

    const getCategoryLabel = (cat: string) => {
        const map: any = {
            'PRODUITS': 'Pharmacie',
            'EXAMENS': 'Examen',
            'ACTES MÉDICAUX': 'Acte',
            'CONSULTATIONS': 'Consultation',
            'HOSPITALISATIONS': 'Hospitalisation',
            'AUTRE': 'Service'
        };
        return map[cat] || cat;
    };

    const isA4 = format === 'A4';

    // Styles for A4 vs 80mm
    const pageSize = isA4 ? 'A4' : '80mm auto';
    const bodyWidth = isA4 ? '100%' : '80mm';
    const bodyPadding = isA4 ? '15mm' : '5mm';
    const fontSize = isA4 ? '12px' : '11px'; // A4 can be slightly larger or same
    const fontFamily = isA4 ? "'Inter', sans-serif" : "'Courier New', monospace"; // A4 looks better with Inter/Arial

    // A4 specific layout classes
    const containerStyle = isA4 ? "max-width: 180mm; margin: 0 auto;" : "";

    return `
        <html>
            <head>
                <title>Ticket ${ticketNum}</title>
                 <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    @page { size: ${pageSize}; margin: 0; }
                    body { margin: 0; padding: ${bodyPadding}; font-family: ${fontFamily}; width: ${bodyWidth}; background: white; color: black; box-sizing: border-box; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .dashed { margin: 10px 0; border-bottom: 1px dashed #000; }
                    .fs-11 { font-size: ${fontSize}; }
                    .fs-12 { font-size: ${isA4 ? '13px' : '12px'}; }
                    table { width: 100%; border-collapse: collapse; font-size: ${fontSize}; }
                    th { text-align: left; border-bottom: 2px solid #000; padding: 5px 0; }
                    td { vertical-align: top; padding-top: 5px; padding-bottom: 5px; border-bottom: ${isA4 ? '1px solid #eee' : 'none'}; }
                    .right { text-align: right; }
                    
                    /* A4 Specifics */
                    ${isA4 ? `
                        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .company-section { text-align: left; }
                        .invoice-info { text-align: right; }
                        .box-info { border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #fdfdfd; margin-bottom: 20px; }
                        .total-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; }
                        tr:last-child td { border-bottom: none; }
                    ` : ''}

                    @media print {
                        body { margin: 0; padding: ${bodyPadding}; width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div style="${containerStyle}">
                
                    ${isA4 ? `
                        <!-- A4 HEADER -->
                        <div class="header-grid">
                            <div class="company-section">
                                <div class="bold" style="font-size: 20px; text-transform: uppercase;">${entreprise.nom_entreprise || 'CENTRE MEDICAL'}</div>
                                <div class="fs-12">${entreprise.adresse || ''}</div>
                                <div class="fs-12">Tel: ${entreprise.telephone || ''}</div>
                            </div>
                            <div class="invoice-info">
                                <div class="bold" style="font-size: 18px;">REÇU DE PAIEMENT</div>
                                <div class="fs-12">N° Ticket: <strong>${ticketNum}</strong></div>
                                <div class="fs-12">Date: ${dateVente.toLocaleString('fr-FR')}</div>
                                <div class="fs-12">Caissier: ${caissier}</div>
                            </div>
                        </div>

                        <!-- PATIENT INFO BOX -->
                        <div class="box-info fs-11">
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <div style="color:#666; font-size:10px; text-transform:uppercase;">Patient</div>
                                    <div class="bold" style="font-size:14px;">${patient?.nom_prenoms || personnel?.nom_prenoms || 'Client Passage'}</div>
                                    ${patient?.numero_carnet ? `<div>N° Carnet: ${patient.numero_carnet}</div>` : ''}
                                    ${patient?.telephone ? `<div>Tel: ${patient.telephone}</div>` : ''}
                                </div>
                                ${patient?.nom_assurance ? `
                                    <div>
                                        <div style="color:#666; font-size:10px; text-transform:uppercase;">Assurance / Prise en Charge</div>
                                        <div class="bold">${patient.nom_assurance}</div>
                                        ${patient.taux_couverture ? `<div>Taux: ${patient.taux_couverture}%</div>` : ''}
                                        ${insForm?.matricule ? `<div>Matricule: ${insForm.matricule}</div>` : ''}
                                        ${insForm?.numeroBon ? `<div>N° Bon: ${insForm.numeroBon}</div>` : ''}
                                    </div>
                                ` : '<div><div style="color:#666; font-size:10px; text-transform:uppercase;">Mode de Règlement</div><div>Comptant / Direct</div></div>'}
                            </div>
                        </div>

                    ` : `
                        <!-- 80mm HEADER -->
                        <div class="center" style="margin-bottom: 15px;">
                            <div class="bold" style="font-size: 16px;">${entreprise.nom_entreprise || 'CENTRE MEDICAL'}</div>
                            <div class="fs-12">${entreprise.adresse || ''}</div>
                            <div class="fs-12">Tel: ${entreprise.telephone || ''}</div>
                            <div class="dashed"></div>
                            <div class="bold">REÇU DE CAISSE</div>
                            <div class="fs-11">Date: ${dateVente.toLocaleString('fr-FR')}</div>
                            <div class="fs-11">Ticket: ${ticketNum}</div>
                            <div class="dashed"></div>
                        </div>
                        
                        <div style="margin-bottom: 10px;" class="fs-11">
                            <div><strong>Patient:</strong> ${patient?.nom_prenoms || personnel?.nom_prenoms || 'Client Passage'}</div>
                            ${patient?.numero_carnet ? `<div><strong>N° Carnet:</strong> ${patient.numero_carnet}</div>` : ''}
                            <div><strong>Caissier:</strong> ${caissier}</div>

                            ${patient?.nom_assurance ? `
                                <div style="margin-top: 5px; border: 1px solid #000; padding: 5px;">
                                    <div><strong>ASSURANCE:</strong> ${patient.nom_assurance}</div>
                                    ${patient.taux_couverture ? `<div><strong>TAUX:</strong> ${patient.taux_couverture}%</div>` : ''}
                                    ${insForm?.matricule ? `<div><strong>MATRICULE:</strong> ${insForm.matricule}</div>` : ''}
                                    ${insForm?.numeroBon ? `<div><strong>N° BON:</strong> ${insForm.numeroBon}</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `}

                    <table>
                        <thead>
                            <tr>
                                <th>Désignation</th>
                                <th class="right">Qte</th>
                                <th class="right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>
                                        <div>${item.libelle}</div>
                                        <div style="font-size: 9px; font-style: italic; color: #555;">${getCategoryLabel(item.categorie || 'AUTRE')}</div>
                                    </td>
                                    <td class="right">${item.qte}</td>
                                    <td class="right">${(item.partPatientUnitaire * item.qte).toLocaleString()} F</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    ${isA4 ? `
                        <!-- A4 TOTALS -->
                         <div class="total-section fs-12">
                            <table style="width: 250px; border: none;">
                                <tr>
                                    <td class="right" style="border:none; padding:2px;">TOTAL BRUT:</td>
                                    <td class="right bold" style="border:none; padding:2px;">${totalBrut.toLocaleString()} F</td>
                                </tr>
                                ${totalPartAssureur > 0 ? `
                                <tr>
                                    <td class="right" style="border:none; padding:2px;">PART ASSURANCE:</td>
                                    <td class="right bold" style="border:none; padding:2px;">-${totalPartAssureur.toLocaleString()} F</td>
                                </tr>
                                ` : ''}
                                <tr style="border-top: 2px solid #000;">
                                    <td class="right bold" style="border:none; padding-top:10px; font-size: 16px;">NET À PAYER:</td>
                                    <td class="right bold" style="border:none; padding-top:10px; font-size: 16px;">${totalNetPatient.toLocaleString()} F</td>
                                </tr>
                            </table>

                             <div style="margin-top: 20px; font-size: 11px; text-align: right;">
                                <div>Mode: ${paiement.mode} | Reçu: ${paiement.montantVerse.toLocaleString()} F | Rendu: ${paiement.rendu.toLocaleString()} F</div>
                            </div>
                        </div>
                    ` : `
                        <!-- 80mm TOTALS -->
                        <div style="border-top: 1px dashed #000; padding-top: 10px; font-size: 12px; margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>TOTAL BRUT:</span>
                                <strong>${totalBrut.toLocaleString()} F</strong>
                            </div>
                            ${totalPartAssureur > 0 ? `
                                <div style="display: flex; justify-content: space-between;">
                                    <span>PART ASSURANCE:</span>
                                    <strong>-${totalPartAssureur.toLocaleString()} F</strong>
                                </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; margin-top: 5px; border-top: 1px solid #000; font-weight: bold; font-size: 14px; padding-top: 5px;">
                                <span>NET À PAYER:</span>
                                <strong>${totalNetPatient.toLocaleString()} F</strong>
                            </div>

                            <div style="margin-top: 10px; font-size: 11px;">
                                    <div style="display: flex; justify-content: space-between;">
                                    <span>Mode:</span>
                                    <span>${paiement.mode}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Reçu:</span>
                                    <span>${paiement.montantVerse.toLocaleString()} F</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Rendu:</span>
                                    <span>${paiement.rendu.toLocaleString()} F</span>
                                </div>
                            </div>
                        </div>
                    `}
                    
                    <div class="center" style="margin-top: 30px; font-size: 11px; font-style: italic; color: #777;">
                        <div>Merci de votre confiance !</div>
                        <div>${new Date().getFullYear()} © Centre Médical</div>
                    </div>

                    <!-- AUTOPRINT SCRIPT OPTIONAL -->
                    <!-- <script>window.onload = function() { window.print(); }</script> -->
                </div>
            </body>
        </html>
    `;
};
