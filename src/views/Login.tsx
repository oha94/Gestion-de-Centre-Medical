import React, { useState } from "react";
import { getDb } from "../lib/db";

interface LoginProps {
    onLoginSuccess: (user: any) => void;
    config: any;
}

export default function Login({ onLoginSuccess, config }: LoginProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const db = await getDb();

            // DEBUG: Compter les utilisateurs
            const countRes = await db.select<any[]>("SELECT COUNT(*) as total FROM app_utilisateurs");
            console.log("Total utilisateurs en base:", countRes[0].total);

            // 1. Chercher l'utilisateur par nom uniquement (trim et insensible à la casse selon collation)
            const userRes = await db.select<any[]>(`
                SELECT u.*, r.nom as role_nom, r.couleur as role_couleur, r.can_delete, r.can_edit
                FROM app_utilisateurs u
                LEFT JOIN app_roles r ON u.role_id = r.id
                WHERE u.username = ?
            `, [username.trim()]);

            if (userRes.length === 0) {
                setError("Cet identifiant n'existe pas.");
                return;
            }

            const foundUser = userRes[0];
            console.log("Utilisateur trouvé:", foundUser);

            // 2. Vérifier le mot de passe
            if (foundUser.password_hash !== password) {
                setError("Mot de passe incorrect.");
                return;
            }

            // 3. Vérifier si actif (On laisse passer l'admin même si désactivé par erreur de migration)
            // Fix: Check for truthy value to handle boolean vs number (1 vs true)
            if (!foundUser.actif && foundUser.username !== 'admin') {
                setError("Ce compte est désactivé.");
                return;
            }

            // Succès
            await db.execute("UPDATE app_utilisateurs SET derniere_connexion = NOW() WHERE id = ?", [foundUser.id]);
            onLoginSuccess(foundUser);

        } catch (err: any) {
            console.error("Login error:", err);
            setError("Erreur : " + (err.message || "Problème de connexion MySQL."));
        } finally {
            setLoading(false);
        }
    };

    const resetAdmin = async () => {
        if (!window.confirm("⚠️ Voulez-vous forcer la réinitialisation du compte admin (admin/admin) ?")) return;
        setLoading(true);
        try {
            const db = await getDb();
            // Création du rôle si manquant
            await db.execute("INSERT IGNORE INTO app_roles (nom, description, couleur, actif) VALUES (?, ?, ?, ?)",
                ['Administrateur', 'Accès complet', '#e74c3c', 1]);
            const resRole = await db.select<any[]>("SELECT id FROM app_roles WHERE nom = 'Administrateur'");
            const rId = resRole[0].id;

            // Création/Update de l'admin (Force actif = 1)
            await db.execute(`
        INSERT INTO app_utilisateurs (nom_complet, username, password_hash, role_id, actif)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE password_hash = 'admin', actif = 1, role_id = ?
      `, ['Administrateur Système', 'admin', 'admin', rId, 1, rId]);

            // Double sécurité : Update explicite
            await db.execute("UPDATE app_utilisateurs SET actif = 1, password_hash = 'admin' WHERE username = 'admin'");

            alert("✅ Compte admin réinitialisé (utilisateur: admin / passe: admin)");
            setUsername("admin");
            setPassword("admin");
        } catch (err: any) {
            alert("❌ Erreur de réinitialisation : " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const testConnection = async () => {
        try {
            const db = await getDb();
            await db.select("SELECT 1");
            alert("✅ Connexion à la base de données réussie !");
        } catch (err: any) {
            alert("❌ Échec de connexion : " + (err.message || "Cause inconnue"));
        }
    };

    return (
        <div style={containerStyle}>
            <div style={glassCardStyle}>
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    {config.logo_app_url ? (
                        <img src={config.logo_app_url} alt="Logo" style={{ maxWidth: '80px', marginBottom: '15px' }} />
                    ) : (
                        <div style={{ fontSize: "50px", marginBottom: "10px" }}>🏥</div>
                    )}
                    <h1 style={{ margin: 0, color: "#2c3e50", fontSize: "24px" }}>{config.nom_application}</h1>
                    <p style={{ color: "#7f8c8d", fontSize: "14px", marginTop: "5px" }}>Gestion de Centre Médical</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: "20px" }}>
                        <label style={labelStyle}>Nom d'utilisateur</label>
                        <div style={inputWrapperStyle}>
                            <span style={iconStyle}>👤</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={inputStyle}
                                placeholder="Entrez votre identifiant"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: "25px" }}>
                        <label style={labelStyle}>Mot de passe</label>
                        <div style={inputWrapperStyle}>
                            <span style={iconStyle}>🔒</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={inputStyle}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={errorStyle}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...buttonStyle,
                            backgroundColor: config.couleur_primaire || "#3498db"
                        }}
                    >
                        {loading ? "Connexion en cours..." : "Se connecter"}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button
                        onClick={resetAdmin}
                        style={{ background: 'none', border: 'none', color: '#3498db', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Réinitialiser Compte Admin (admin/admin)
                    </button>

                    <button
                        onClick={testConnection}
                        style={{ background: 'none', border: 'none', color: '#7f8c8d', fontSize: '11px', cursor: 'pointer' }}
                    >
                        🔍 Tester la connexion à la base de données
                    </button>
                </div>

                <div style={{ textAlign: "center", marginTop: "30px", fontSize: "12px", color: "#95a5a6" }}>
                    <div>Version 1.0.0</div>
                    <div style={{ marginTop: "5px" }}>© 2024 Centre Médical</div>
                </div>
            </div>
        </div>
    );
}

// STYLES
const containerStyle: React.CSSProperties = {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

const glassCardStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(10px)",
    borderRadius: "20px",
    padding: "40px",
    width: "400px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#34495e",
};

const inputWrapperStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
};

const iconStyle: React.CSSProperties = {
    position: "absolute",
    left: "12px",
    fontSize: "16px",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px 12px 40px",
    borderRadius: "10px",
    border: "1px solid #dcdde1",
    fontSize: "15px",
    transition: "0.3s",
    outline: "none",
};

const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "0.3s",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
};

const errorStyle: React.CSSProperties = {
    background: "#f8d7da",
    color: "#721c24",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "20px",
    textAlign: "center",
    border: "1px solid #f5c6cb",
};
