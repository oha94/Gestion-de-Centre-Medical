import { useState, useEffect, CSSProperties } from "react";
import { getDb, getCompanyInfo } from "../../lib/db";
import { exportToExcel } from "../../lib/exportUtils";
import { toFRFormat } from "../../utils/formatUtils";

// --- TYPES ---

interface AccountEntry {
    date: string;
    type: 'FACTURE' | 'REGLEMENT';
    reference: string;
    libelle: string;
    debit: number;  // Ce que le client doit (Invoice)
    credit: number; // Ce que le client paie (Payment)
    solde: number;  // Solde courant après cette opération
}

type EntityType = 'PATIENT' | 'ASSURANCE' | 'PERSONNEL';

export default function SuiviComptesClients() {
    // UI STATES
    const [activeTab, setActiveTab] = useState<EntityType>('PATIENT');
    const [searchTerm, setSearchTerm] = useState("");
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // SELECTION STATES
    const [entities, setEntities] = useState<any[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
    const [history, setHistory] = useState<AccountEntry[]>([]);
    const [summary, setSummary] = useState({ totalBilled: 0, totalPaid: 0, balance: 0 });
    const [loading, setLoading] = useState(false);

    // 1. CARGER LES ENTITÉS (Selon l'onglet)
    useEffect(() => {
        const loadEntities = async () => {
            try {
                const db = await getDb();
                let query = "";
                if (activeTab === 'PATIENT') {
                    query = "SELECT id, nom_prenoms as nom, numero_carnet as ref FROM patients ORDER BY nom_prenoms ASC LIMIT 100";
                } else if (activeTab === 'ASSURANCE') {
                    query = "SELECT id, nom_assurance as nom, '' as ref FROM assurances ORDER BY nom_assurance ASC";
                } else if (activeTab === 'PERSONNEL') {
                    query = "SELECT id, nom_prenoms as nom, fonction as ref FROM personnel ORDER BY nom_prenoms ASC";
                }
                const res = await db.select<any[]>(query);
                setEntities(res);
                setSelectedEntity(null);
                setHistory([]);
            } catch (e) { console.error(e); }
        };
        loadEntities();
    }, [activeTab]);

    // 2. CARGER L'HISTORIQUE DU COMPTE
    const loadHistory = async () => {
        if (!selectedEntity) return;
        setLoading(true);
        try {
            const db = await getDb();
            const entries: AccountEntry[] = [];

            // A. RÉCUPÉRER LES FACTURES (DÉBIT)
            let salesQuery = "";
            let params: any[] = [];

            if (activeTab === 'PATIENT') {
                salesQuery = "SELECT * FROM ventes WHERE patient_id = ? AND date_vente BETWEEN ? AND ? ORDER BY date_vente ASC";
                params = [selectedEntity.id, startDate + " 00:00:00", endDate + " 23:59:59"];
            } else if (activeTab === 'PERSONNEL') {
                salesQuery = "SELECT * FROM ventes WHERE personnel_id = ? AND date_vente BETWEEN ? AND ? ORDER BY date_vente ASC";
                params = [selectedEntity.id, startDate + " 00:00:00", endDate + " 23:59:59"];
            } else if (activeTab === 'ASSURANCE') {
                salesQuery = `
                    SELECT v.* 
                    FROM ventes v 
                    JOIN patients p ON v.patient_id = p.id 
                    WHERE p.assurance_id = ? AND v.date_vente BETWEEN ? AND ? 
                    ORDER BY v.date_vente ASC`;
                params = [selectedEntity.id, startDate + " 00:00:00", endDate + " 23:59:59"];
            }

            const sales = await db.select<any[]>(salesQuery, params);
            
            sales.forEach(s => {
                entries.push({
                    date: s.date_vente,
                    type: 'FACTURE',
                    reference: s.numero_ticket || `FAC-${s.id}`,
                    libelle: s.acte_libelle,
                    debit: activeTab === 'ASSURANCE' ? s.part_assureur : s.part_patient,
                    credit: 0,
                    solde: 0 // Will be calculated after sorting
                });
            });

            // B. RÉCUPÉRER LES RÈGLEMENTS (CRÉDIT)
            let paymentsQuery = "";
            if (activeTab === 'PATIENT' || activeTab === 'PERSONNEL') {
                const idField = activeTab === 'PATIENT' ? 'patient_id' : 'personnel_id';
                paymentsQuery = `
                    SELECT cm.date_mouvement, cm.reference, cm.motif, rd.montant_regle, v.numero_ticket
                    FROM caisse_recouvrements_details rd
                    JOIN caisse_mouvements cm ON rd.caisse_mouvement_id = cm.id
                    JOIN ventes v ON rd.vente_id = v.id
                    WHERE v.${idField} = ? AND cm.date_mouvement BETWEEN ? AND ?
                `;
            } else if (activeTab === 'ASSURANCE') {
                paymentsQuery = `
                    SELECT cm.date_mouvement, cm.reference, cm.motif, rd.montant_regle, v.numero_ticket
                    FROM caisse_recouvrements_details rd
                    JOIN caisse_mouvements cm ON rd.caisse_mouvement_id = cm.id
                    JOIN ventes v ON rd.vente_id = v.id
                    JOIN patients p ON v.patient_id = p.id
                    WHERE p.assurance_id = ? AND cm.date_mouvement BETWEEN ? AND ?
                `;
            }

            const payments = await db.select<any[]>(paymentsQuery, params);
            payments.forEach(p => {
                entries.push({
                    date: p.date_mouvement,
                    type: 'REGLEMENT',
                    reference: p.reference || 'PAY',
                    libelle: `Règlement ${p.numero_ticket || ''} - ${p.motif || ''}`,
                    debit: 0,
                    credit: p.montant_regle,
                    solde: 0
                });
            });

            // C. TRI ET CALCUL DU SOLDE PROGRESSIF
            entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            let runningBalance = 0;
            const finalHistory = entries.map(e => {
                runningBalance += (e.debit - e.credit);
                return { ...e, solde: runningBalance };
            });

            setHistory(finalHistory);

            setSummary({
                totalBilled: finalHistory.reduce((acc, curr) => acc + curr.debit, 0),
                totalPaid: finalHistory.reduce((acc, curr) => acc + curr.credit, 0),
                balance: runningBalance
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [selectedEntity, startDate, endDate]);

    // --- ACTIONS ---

    const handlePrint = async () => {
        const company = await getCompanyInfo();
        const html = `
            <html>
                <head>
                    <title>Relevé de Compte - ${selectedEntity?.nom}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; color: #333; text-transform: uppercase; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
                        .summary { display: flex; gap: 40px; margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 10px; }
                        .summary-item { text-align: center; }
                        .summary-val { display: block; font-size: 1.5rem; font-weight: bold; color: #2c3e50; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #3498db; color: white; padding: 12px; text-align: left; }
                        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
                        .debit { color: #e74c3c; font-weight: bold; }
                        .credit { color: #27ae60; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1>RELEVÉ DE COMPTE</h1>
                            <p><strong>Bénéficiaire :</strong> ${selectedEntity?.nom}</p>
                            <p><strong>Période :</strong> Du ${toFRFormat(startDate)} au ${toFRFormat(endDate)}</p>
                        </div>
                        <div style="text-align: right;">
                            <h2>${company.nom}</h2>
                            <p>${company.adresse}</p>
                            <p>${company.telephone}</p>
                        </div>
                    </div>

                    <div class="summary">
                        <div class="summary-item">
                            <span class="summary-val">${summary.totalBilled.toLocaleString()} F</span>
                            <small>Total Consommé</small>
                        </div>
                        <div class="summary-item">
                            <span class="summary-val">${summary.totalPaid.toLocaleString()} F</span>
                            <small>Total Réglé</small>
                        </div>
                        <div class="summary-item" style="margin-left: auto;">
                            <span class="summary-val" style="color: ${summary.balance > 0 ? '#e74c3c' : '#27ae60'}">${summary.balance.toLocaleString()} F</span>
                            <small>SOLDE ACTUEL</small>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Référence</th>
                                <th>Libellé</th>
                                <th>Débit (+)</th>
                                <th>Crédit (-)</th>
                                <th>Solde</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(h => `
                                <tr>
                                    <td>${new Date(h.date).toLocaleDateString()}</td>
                                    <td>${h.reference}</td>
                                    <td>${h.libelle}</td>
                                    <td class="debit">${h.debit > 0 ? h.debit.toLocaleString() : '-'}</td>
                                    <td class="credit">${h.credit > 0 ? h.credit.toLocaleString() : '-'}</td>
                                    <td style="font-weight: bold;">${h.solde.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
        win?.print();
    };

    const handleExport = () => {
        const data = history.map(h => ({
            'Date': new Date(h.date).toLocaleDateString(),
            'Type': h.type,
            'Référence': h.reference,
            'Libellé': h.libelle,
            'Débit': h.debit,
            'Crédit': h.credit,
            'Solde': h.solde
        }));
        exportToExcel(data, `Releve_Compte_${selectedEntity?.nom}_${startDate}`);
    };

    // --- RENDU ---

    return (
        <div style={containerStyle}>
            {/* EN-TÊTE ET TABS */}
            <div style={headerStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#2c3e50' }}>📒 SUIVI DES COMPTES CLIENTS</h1>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handlePrint} disabled={!selectedEntity} style={btnLight}>🖨️ Imprimer Relevé</button>
                        <button onClick={handleExport} disabled={!selectedEntity} style={btnLight}>📊 Export Excel</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #eee' }}>
                    <TabBtn label="Comptes Patients" id="PATIENT" active={activeTab} onClick={setActiveTab} />
                    <TabBtn label="Assurances / Tiers" id="ASSURANCE" active={activeTab} onClick={setActiveTab} />
                    <TabBtn label="Comptes Personnel" id="PERSONNEL" active={activeTab} onClick={setActiveTab} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden', padding: '20px' }}>
                
                {/* LISTE DES COMPTES (GAUCHE) */}
                <div style={listAreaStyle}>
                    <div style={{ marginBottom: '15px' }}>
                        <input 
                            placeholder={`Chercher ${activeTab.toLowerCase()}...`} 
                            style={inputStyle} 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {entities.filter(e => e.nom && e.nom.toLowerCase().includes(searchTerm.toLowerCase())).map(e => (
                            <div 
                                key={e.id} 
                                onClick={() => setSelectedEntity(e)}
                                style={{
                                    ...entityCardStyle,
                                    backgroundColor: selectedEntity?.id === e.id ? '#3498db' : 'white',
                                    color: selectedEntity?.id === e.id ? 'white' : '#2c3e50'
                                }}
                            >
                                <div style={{ fontWeight: 'bold' }}>{e.nom}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{e.ref}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* HISTORIQUE ET DÉTAILS (DROITE) */}
                <div style={detailAreaStyle}>
                    {selectedEntity ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            
                            {/* FILTRES PÉRIODE */}
                            <div style={filterBarStyle}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>PÉRIODE DU :</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputSmall} />
                                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>AU :</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputSmall} />
                                </div>
                            </div>

                            {/* RÉSUMÉ */}
                            <div style={summaryAreaStyle}>
                                <div style={sumBoxStyle}>
                                    <small>CONSOMMATION PÉRIODE</small>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{summary.totalBilled.toLocaleString()} F</div>
                                </div>
                                <div style={sumBoxStyle}>
                                    <small>RÈGLEMENTS PÉRIODE</small>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#27ae60' }}>{summary.totalPaid.toLocaleString()} F</div>
                                </div>
                                <div style={{ ...sumBoxStyle, marginLeft: 'auto', background: summary.balance > 0 ? '#fff5f5' : '#f0fff4', border: `1px solid ${summary.balance > 0 ? '#feb2b2' : '#9ae6b4'}` }}>
                                    <small>SOLDE SUR LA PÉRIODE</small>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: summary.balance > 0 ? '#c53030' : '#2f855a' }}>{summary.balance.toLocaleString()} F</div>
                                </div>
                            </div>

                            {/* TABLEAU */}
                            <div style={{ flex: 1, overflowY: 'auto', background: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <table style={tableStyle}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                                        <tr>
                                            <th style={thStyle}>Date</th>
                                            <th style={thStyle}>Référence</th>
                                            <th style={thStyle}>Libellé</th>
                                            <th style={thStyle}>Débit (+)</th>
                                            <th style={thStyle}>Crédit (-)</th>
                                            <th style={thStyle}>Solde</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Chargement...</td></tr>
                                        ) : history.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>Aucune transaction sur cette période.</td></tr>
                                        ) : (
                                            history.map((h, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid #f1f1f1' }}>
                                                    <td style={tdStyle}>{new Date(h.date).toLocaleDateString()}</td>
                                                    <td style={tdStyle}><small>{h.reference}</small></td>
                                                    <td style={tdStyle}>{h.libelle}</td>
                                                    <td style={{ ...tdStyle, color: '#e74c3c', fontWeight: h.debit > 0 ? 'bold' : 'normal' }}>{h.debit > 0 ? h.debit.toLocaleString() : '-'}</td>
                                                    <td style={{ ...tdStyle, color: '#27ae60', fontWeight: h.credit > 0 ? 'bold' : 'normal' }}>{h.credit > 0 ? h.credit.toLocaleString() : '-'}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{h.solde.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    ) : (
                        <div style={emptyStateStyle}>
                            <span style={{ fontSize: '4rem', marginBottom: '20px' }}>🔎</span>
                            <h3>SÉLECTIONNEZ UN COMPTE</h3>
                            <p>Choisissez une assurance, un patient ou un membre du personnel dans la liste à gauche pour voir son historique financier.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// --- SOUS-COMPOSANTS ---

function TabBtn({ label, id, active, onClick }: any) {
    const isSelected = active === id;
    return (
        <button 
            onClick={() => onClick(id)}
            style={{
                padding: '12px 25px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? '#3498db' : '#7f8c8d',
                borderBottom: isSelected ? '3px solid #3498db' : '3px solid transparent',
                transition: 'all 0.2s'
            }}
        >
            {label}
        </button>
    );
}

// --- STYLES ---

const containerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%', background: '#f4f7f6', overflow: 'hidden' };
const headerStyle: CSSProperties = { background: 'white', padding: '20px 20px 0 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const listAreaStyle: CSSProperties = { width: '320px', display: 'flex', flexDirection: 'column', background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const detailAreaStyle: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column' };
const entityCardStyle: CSSProperties = { padding: '12px 15px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', transition: '0.2s', border: '1px solid #eee' };
const filterBarStyle: CSSProperties = { background: 'white', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const summaryAreaStyle: CSSProperties = { display: 'flex', gap: '15px', marginBottom: '15px' };
const sumBoxStyle: CSSProperties = { flex: 1, background: 'white', padding: '15px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' };
const inputSmall: CSSProperties = { padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.85rem' };
const btnLight: CSSProperties = { padding: '8px 15px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: '#2c3e50' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontSize: '0.85rem' };
const tdStyle: CSSProperties = { padding: '12px', fontSize: '0.85rem' };
const emptyStateStyle: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#95a5a6', textAlign: 'center', padding: '40px' };
