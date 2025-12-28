import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";
import { DateTravailManager } from "../../services/DateTravailManager";
import { DateSystemeService } from "../../services/DateSystemeService";
import Caisse from "./Caisse";
import Recouvrement from "./Recouvrement";
import CaisseTransfertView from "./CaisseTransfert";
import ListeVentes from "./ListeVentes";
import ClotureJournee from "./ClotureJournee";
import FactureAssurance from "./FactureAssurance";


import Decaissement from "./Decaissement";
import Versement from "./Versement";
import Commande from "./Commande";

export default function BillingMain({ currentUser }: { currentUser?: any }) {
    const [view, setView] = useState('caisse');
    const [user, setUser] = useState<any>(currentUser || null);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [softwareDate, setSoftwareDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [clotureRequise, setClotureRequise] = useState(false);
    const [messageBloquage, setMessageBloquage] = useState('');

    useEffect(() => {
        if (currentUser) setUser(currentUser);
    }, [currentUser]);

    // --- TIME CHECK LOGIC ---
    useEffect(() => {
        const checkTime = async () => {
            try {
                const db = await getDb();
                const res = await db.select<any[]>("SELECT CURRENT_TIMESTAMP as now");
                if (res.length > 0) {
                    const dbDate = new Date(res[0].now);
                    const localDate = new Date();
                    const diffMs = Math.abs(dbDate.getTime() - localDate.getTime());
                    const diffMin = diffMs / 1000 / 60;
                    console.log(`Time diff: ${diffMin} mins`);
                }

                // Load software date (date travail)
                const dateTravail = await DateTravailManager.getDateTravail();
                if (dateTravail) setSoftwareDate(dateTravail);

                // Vérifier si la clôture est requise
                const verification = await DateSystemeService.verifierAvantAction();
                if (!verification.autorise) {
                    setClotureRequise(true);
                    setMessageBloquage(verification.message);
                } else {
                    setClotureRequise(false);
                    setMessageBloquage('');
                }

            } catch (e) { console.error("Time check failed", e); }
        };

        checkTime();
        const timer = setInterval(() => {
            setCurrentDate(new Date());
            checkTime();
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const toggleSidebar = () => setSidebarCollapsed(!isSidebarCollapsed);

    const menuItems = [
        { id: 'caisse', label: '🏪 Caisse POS', icon: '🏪' },
        { id: 'commande', label: '📦 Commandes', icon: '📦' },
        { id: 'transfert', label: '🔁 Caisse de Transfert', icon: '🔁' },
        { id: 'ventes', label: '🧾 Liste Ventes', icon: '🧾' },
        { id: 'recouvrement', label: '💸 Recouvrement', icon: '💸' },
        { id: 'assurance', label: '🛡️ Fact. Assurance', icon: '🛡️' },
        { id: 'decaissement', label: '📤 Décaissement', icon: '📤' },
        { id: 'versement', label: '🏦 Versement', icon: '🏦' },
        { id: 'cloture', label: '🔒 Clôture Jour', icon: '🔒' },
    ];

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = currentDate.toLocaleDateString('fr-FR', dateOptions);
    const timeStr = currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const softwareDateStr = softwareDate ? new Date(softwareDate).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : dateStr;

    return (
        <div style={{ display: 'flex', height: '100%', fontFamily: 'Inter, sans-serif', background: '#f4f6f9', overflow: 'hidden' }}>
            {/* SIDEBAR */}
            <div style={{
                width: isSidebarCollapsed ? '70px' : '240px',
                background: '#2c3e50',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
                zIndex: 10
            }}>
                <div style={{ padding: '20px 15px', borderBottom: '1px solid #34495e', display: 'flex', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', alignItems: 'center' }}>
                    {!isSidebarCollapsed && <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>💰 FACTURES</h2>}
                    <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: '#95a5a6', cursor: 'pointer', fontSize: '18px' }}>
                        {isSidebarCollapsed ? '»' : '«'}
                    </button>
                </div>

                <div style={{ flex: 1, padding: '10px 5px', overflowY: 'auto' }}>
                    {menuItems.map(item => {
                        const active = view === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                title={isSidebarCollapsed ? item.label : ""}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: active ? '#3498db' : 'transparent',
                                    color: active ? 'white' : '#ecf0f1',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                                    gap: '15px',
                                    marginBottom: '5px',
                                    transition: 'all 0.2s',
                                    borderLeft: active && !isSidebarCollapsed ? '4px solid #fff' : '4px solid transparent',
                                }}
                            >
                                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                                {!isSidebarCollapsed && <span style={{ fontSize: '14px', fontWeight: active ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{item.label}</span>}
                            </button>
                        );
                    })}
                </div>

                <div style={{ padding: '15px', borderTop: '1px solid #34495e', textAlign: 'center', fontSize: '11px', color: '#7f8c8d' }}>
                    {!isSidebarCollapsed ? 'v2.2 POS Edition' : 'v2.2'}
                </div>
            </div>

            {/* MAIN CONTENT Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* HEADER */}
                <div style={{ background: 'white', padding: '15px 25px', borderBottom: '2px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>📅 Date Système (Travail)</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2196f3' }}>{softwareDateStr}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: '#95a5a6' }}>SESSION: {user?.nom_complet || 'Admin'}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2c3e50' }}>{dateStr} - {timeStr}</div>
                    </div>
                </div>

                {/* VIEW AREA */}
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {/* Bannière de blocage si clôture requise */}
                    {clotureRequise && view !== 'cloture' && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(255, 255, 255, 0.98)',
                            zIndex: 1000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(5px)'
                        }}>
                            <div style={{
                                background: 'white',
                                border: '3px solid #e74c3c',
                                borderRadius: '20px',
                                padding: '50px',
                                maxWidth: '600px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🔒</div>
                                <h2 style={{ color: '#e74c3c', fontSize: '2rem', marginBottom: '20px' }}>MODULE BLOQUÉ</h2>
                                <p style={{ color: '#2c3e50', fontSize: '1.2rem', lineHeight: '1.8', marginBottom: '30px', whiteSpace: 'pre-line' }}>
                                    {messageBloquage}
                                </p>
                                <button
                                    onClick={() => setView('cloture')}
                                    style={{
                                        padding: '18px 40px',
                                        background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)'
                                    }}
                                >
                                    🔒 Aller à la Clôture
                                </button>
                            </div>
                        </div>
                    )}
                    {view === 'caisse' && <Caisse softwareDate={softwareDate} currentUser={user} />}
                    {view === 'commande' && <Commande currentUser={user} />}
                    {view === 'transfert' && <CaisseTransfertView />}
                    {view === 'ventes' && <ListeVentes softwareDate={softwareDate} setView={setView} currentUser={user} />}
                    {view === 'cloture' && <ClotureJournee currentUser={user} />}
                    {view === 'recouvrement' && <Recouvrement currentUser={user} />}
                    {view === 'assurance' && <FactureAssurance currentUser={user} />}
                    {view === 'decaissement' && <Decaissement currentUser={user} />}
                    {view === 'versement' && <Versement currentUser={user} />}
                </div>
            </div>
        </div>
    );
}
