import { useState, useEffect } from "react";
import { getDb } from "../../lib/db";
import { DateTravailManager } from "../../services/DateTravailManager";
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
