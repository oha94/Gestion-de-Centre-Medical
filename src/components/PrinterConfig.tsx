import React, { useState, useEffect } from 'react';
import { getDb } from '../lib/db';

export default function PrinterConfig() {
    const [printers, setPrinters] = useState<string[]>([]);
    const [caisseP printer, setCaissePrinter] = useState('');
    const [documentPrinter, setDocumentPrinter] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
        loadPrinters();
    }, []);

    const loadPrinters = async () => {
        try {
            // En Tauri, on peut utiliser window.__TAURI__ pour accéder aux imprimantes
            // Pour l'instant, on simule avec des imprimantes par défaut
            const availablePrinters = [
                'Imprimante par défaut',
                'Microsoft Print to PDF',
                'Imprimante Thermique POS-80',
                'HP LaserJet',
                'Canon PIXMA'
            ];
            setPrinters(availablePrinters);
        } catch (error) {
            console.error('Erreur chargement imprimantes:', error);
        }
    };

    const loadConfig = async () => {
        setLoading(true);
        try {
            const db = await getDb();
            const result = await db.select<any[]>(
                'SELECT imprimante_caisse, imprimante_documents FROM app_parametres_app WHERE id = 1'
            );

            if (result.length > 0) {
                setCaissePrinter(result[0].imprimante_caisse || '');
                setDocumentPrinter(result[0].imprimante_documents || '');
            }
        } catch (error) {
            console.error('Erreur chargement config:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const db = await getDb();
            await db.execute(
                'UPDATE app_parametres_app SET imprimante_caisse = ?, imprimante_documents = ? WHERE id = 1',
                [caissePrinter, documentPrinter]
            );
            alert('✅ Configuration enregistrée avec succès !');
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('❌ Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const testTicketPrint = () => {
        if (!caissePrinter) {
            alert('⚠️ Veuillez sélectionner une imprimante pour la caisse');
            return;
        }

        const printWindow = window.open('', '', 'width=300,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
      <head>
        <title>Test Ticket</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          hr { border: 1px dashed #000; }
        </style>
      </head>
      <body>
        <div class="center bold">CENTRE MÉDICAL</div>
        <div class="center">Test d'impression</div>
        <hr>
        <div>Date: ${new Date().toLocaleString('fr-FR')}</div>
        <div>Imprimante: ${caissePrinter}</div>
        <hr>
        <div class="center">TICKET DE TEST</div>
        <div class="center">Ceci est un test d'impression</div>
        <div class="center">pour ticket de caisse</div>
        <hr>
        <div class="center">Merci !</div>
      </body>
      </html>
    `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    const testA4Print = () => {
        if (!documentPrinter) {
            alert('⚠️ Veuillez sélectionner une imprimante pour les documents');
            return;
        }

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
      <head>
        <title>Test Document A4</title>
        <style>
          @page { size: A4; margin: 2cm; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #667eea; 
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .content { line-height: 1.6; }
          .footer { 
            margin-top: 50px; 
            text-align: center; 
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CENTRE MÉDICAL</h1>
          <h2>Test d'Impression A4</h2>
        </div>
        <div class="content">
          <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <p><strong>Imprimante:</strong> ${documentPrinter}</p>
          <hr>
          <h3>Test d'impression de document</h3>
          <p>Ceci est un test d'impression pour les documents au format A4.</p>
          <p>Cette page permet de vérifier que l'imprimante sélectionnée fonctionne correctement.</p>
          <ul>
            <li>Format: A4</li>
            <li>Orientation: Portrait</li>
            <li>Marges: 2cm</li>
          </ul>
        </div>
        <div class="footer">
          <p>Document de test généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </body>
      </html>
    `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    if (loading) {
        return <div style={containerStyle}>Chargement...</div>;
    }

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h2 style={titleStyle}>🖨️ Configuration des Imprimantes</h2>
                <p style={subtitleStyle}>Configurez les imprimantes par défaut pour votre système</p>

                {/* Imprimante Caisse */}
                <div style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>🧾 Imprimante Caisse (Tickets)</h3>
                    <p style={descStyle}>Pour l'impression des tickets de caisse (format 80mm)</p>

                    <select
                        value={caissePrinter}
                        onChange={(e) => setCaissePrinter(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Sélectionner une imprimante...</option>
                        {printers.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <button onClick={testTicketPrint} style={testButtonStyle} disabled={!caissePrinter}>
                        🧪 Tester Impression Ticket
                    </button>
                </div>

                {/* Imprimante Documents */}
                <div style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>📄 Imprimante Documents (A4)</h3>
                    <p style={descStyle}>Pour l'impression des documents, rapports et factures A4</p>

                    <select
                        value={documentPrinter}
                        onChange={(e) => setDocumentPrinter(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Sélectionner une imprimante...</option>
                        {printers.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <button onClick={testA4Print} style={testButtonStyle} disabled={!documentPrinter}>
                        🧪 Tester Impression A4
                    </button>
                </div>

                {/* Bouton Enregistrer */}
                <div style={actionsStyle}>
                    <button onClick={saveConfig} style={saveButtonStyle} disabled={saving}>
                        {saving ? '⏳ Enregistrement...' : '💾 Enregistrer la Configuration'}
                    </button>
                </div>

                {/* Info */}
                <div style={infoBoxStyle}>
                    <strong>ℹ️ Information:</strong> Les imprimantes configurées ici seront utilisées par défaut
                    pour toutes les impressions de l'application.
                </div>
            </div>
        </div>
    );
}

// ============ STYLES ============

const containerStyle: React.CSSProperties = {
    padding: '30px',
    height: '100%',
    overflow: 'auto',
    backgroundColor: '#f8f9fa'
};

const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '800px',
    margin: '0 auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
};

const titleStyle: React.CSSProperties = {
    margin: '0 0 10px 0',
    fontSize: '28px',
    color: '#2c3e50',
    fontWeight: '700'
};

const subtitleStyle: React.CSSProperties = {
    margin: '0 0 30px 0',
    fontSize: '15px',
    color: '#7f8c8d'
};

const sectionStyle: React.CSSProperties = {
    marginBottom: '35px',
    padding: '25px',
    background: '#f8f9fa',
    borderRadius: '12px',
    border: '1px solid #e9ecef'
};

const sectionTitleStyle: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: '18px',
    color: '#34495e',
    fontWeight: '600'
};

const descStyle: React.CSSProperties = {
    margin: '0 0 15px 0',
    fontSize: '14px',
    color: '#7f8c8d'
};

const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '15px',
    cursor: 'pointer'
};

const testButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s'
};

const actionsStyle: React.CSSProperties = {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #e9ecef'
};

const saveButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)'
};

const infoBoxStyle: React.CSSProperties = {
    marginTop: '20px',
    padding: '15px',
    background: '#e3f2fd',
    border: '1px solid #90caf9',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#1976d2'
};
