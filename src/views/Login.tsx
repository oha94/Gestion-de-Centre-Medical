import React, { useState, useEffect } from "react";
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
    const [entrepriseInfo, setEntrepriseInfo] = useState<any>(null);
    const [serverYear, setServerYear] = useState<number>(new Date().getFullYear());

    useEffect(() => {
        chargerInfosEntreprise();
    }, []);

    const chargerInfosEntreprise = async () => {
        try {
            const db = await getDb();

            // Charger les informations de l'entreprise
            const resEntreprise = await db.select<any[]>("SELECT * FROM app_parametres_entreprise LIMIT 1");
            if (resEntreprise.length > 0) {
                setEntrepriseInfo(resEntreprise[0]);
            }

            // Récupérer l'année du serveur
            const resDate = await db.select<any[]>("SELECT YEAR(CURRENT_TIMESTAMP) as annee");
            if (resDate.length > 0) {
                setServerYear(resDate[0].annee);
            }
        } catch (err) {
            console.error("Erreur chargement infos:", err);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const db = await getDb();

            const userRes = await db.select<any[]>(`
                SELECT u.*, r.nom as role_nom, r.couleur as role_couleur, r.can_delete, r.can_edit
                FROM app_utilisateurs u
                LEFT JOIN app_roles r ON u.role_id = r.id
                WHERE u.username = ?
            `, [username.trim()]);

            if (userRes.length === 0) {
                setError("Identifiant incorrect");
                return;
            }

            const foundUser = userRes[0];

            if (foundUser.password_hash !== password) {
                setError("Mot de passe incorrect");
                return;
            }

            if (!foundUser.actif && foundUser.username !== 'admin') {
                setError("Ce compte est désactivé");
                return;
            }

            await db.execute("UPDATE app_utilisateurs SET derniere_connexion = NOW() WHERE id = ?", [foundUser.id]);
            onLoginSuccess(foundUser);

        } catch (err: any) {
            console.error("Login error:", err);
            setError("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    // Déterminer le logo et le nom à afficher
    const logoUrl = entrepriseInfo?.logo_url || config.logo_app_url;
    const nomEntreprise = entrepriseInfo?.nom_entreprise || config.nom_application;

    return (
        <div style={containerStyle}>
            <div style={loginCardStyle}>
                {/* Logo et nom de l'entreprise */}
                <div style={headerStyle}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" style={logoStyle} />
                    ) : (
                        <div style={iconPlaceholderStyle}>🏥</div>
                    )}
                    <h1 style={titleStyle}>{nomEntreprise}</h1>
                </div>

                {/* Formulaire de connexion */}
                <form onSubmit={handleLogin} style={formStyle}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Identifiant</label>
                        <div style={inputWrapperStyle}>
                            <span style={inputIconStyle}>👤</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={inputStyle}
                                placeholder="Nom d'utilisateur"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Mot de passe</label>
                        <div style={inputWrapperStyle}>
                            <span style={inputIconStyle}>🔒</span>
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
                            <span style={{ marginRight: '8px' }}>⚠️</span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            ...buttonStyle,
                            backgroundColor: loading ? '#95a5a6' : (config.couleur_primaire || "#3498db"),
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? (
                            <>
                                <span style={{ marginRight: '8px' }}>⏳</span>
                                Connexion en cours...
                            </>
                        ) : (
                            <>
                                <span style={{ marginRight: '8px' }}>🔓</span>
                                Se connecter
                            </>
                        )}
                    </button>
                </form>

                {/* Footer avec copyright */}
                <div style={footerStyle}>
                    <div style={copyrightStyle}>
                        © {serverYear} {entrepriseInfo?.nom_entreprise || nomEntreprise}
                    </div>
                    {entrepriseInfo?.slogan && (
                        <div style={sloganStyle}>{entrepriseInfo.slogan}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============ STYLES ============

const containerStyle: React.CSSProperties = {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: "fixed",
    top: 0,
    left: 0,
    overflow: "hidden"
};

const loginCardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: "24px",
    padding: "50px 45px",
    width: "440px",
    maxWidth: "90%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    animation: "slideUp 0.5s ease-out",
    position: "relative",
    zIndex: 1
};

const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "40px"
};

const logoStyle: React.CSSProperties = {
    maxWidth: "100px",
    maxHeight: "100px",
    marginBottom: "20px",
    objectFit: "contain"
};

const iconPlaceholderStyle: React.CSSProperties = {
    fontSize: "64px",
    marginBottom: "15px"
};

const titleStyle: React.CSSProperties = {
    margin: "0 0 8px 0",
    color: "#2c3e50",
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.5px"
};

const formStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "24px"
};

const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "8px"
};

const labelStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#34495e",
    marginLeft: "4px"
};

const inputWrapperStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center"
};

const inputIconStyle: React.CSSProperties = {
    position: "absolute",
    left: "16px",
    fontSize: "18px",
    pointerEvents: "none",
    zIndex: 1
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px 14px 48px",
    borderRadius: "12px",
    border: "2px solid #e0e0e0",
    fontSize: "15px",
    transition: "all 0.3s ease",
    outline: "none",
    fontFamily: "inherit",
    backgroundColor: "#fafafa"
};

const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "16px",
    borderRadius: "12px",
    border: "none",
    color: "white",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
};

const errorStyle: React.CSSProperties = {
    background: "#fee",
    color: "#c0392b",
    padding: "14px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    textAlign: "center",
    border: "1px solid #f5c6cb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
};

const footerStyle: React.CSSProperties = {
    marginTop: "40px",
    paddingTop: "24px",
    borderTop: "1px solid #ecf0f1",
    textAlign: "center"
};

const copyrightStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#95a5a6",
    fontWeight: "500"
};

const sloganStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#bdc3c7",
    marginTop: "8px",
    fontStyle: "italic"
};
