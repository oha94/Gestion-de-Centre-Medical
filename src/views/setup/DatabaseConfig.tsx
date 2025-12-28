import { useState, useEffect } from "react";
import Database from "@tauri-apps/plugin-sql";

export default function DatabaseConfig({ onConfigured }: { onConfigured: () => void }) {
    const [config, setConfig] = useState({
        host: "127.0.0.1",
        port: "3306",
        user: "root",
        password: "",
        database: "focolari_db"
    });
    const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("db_config");
        if (saved) {
            setConfig(JSON.parse(saved));
        }
    }, []);

    const handleChange = (field: string, value: string) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const getConnectionString = () => {
        const { host, port, user, password, database } = config;
        return `mysql://${user}:${password}@${host}:${port}/${database}`;
    };

    const testConnection = async () => {
        setStatus("testing");
        setErrorMsg("");
        try {
            const db = await Database.load(getConnectionString());
            // Try a simple query
            await db.select("SELECT 1");
            setStatus("success");
            alert("Connexion réussie !");
            return true;
        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.toString());
            return false;
        }
    };

    const handleSave = async () => {
        const success = await testConnection();
        if (success) {
            localStorage.setItem("db_config", JSON.stringify(config));
            alert("Configuration sauvegardée !");
            onConfigured();
        }
    };

    return (
        <div style={{
            height: "100vh", display: "flex", justifyContent: "center", alignItems: "center",
            background: "linear-gradient(135deg, #2c3e50, #3498db)", fontFamily: "Arial, sans-serif"
        }}>
            <div style={{
                background: "white", padding: "40px", borderRadius: "15px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)", width: "400px"
            }}>
                <h2 style={{ textAlign: "center", color: "#2c3e50", marginBottom: "30px" }}>🔧 Configuration Base de Données</h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "5px", color: "#7f8c8d", fontSize: "12px", fontWeight: "bold" }}>SERVEUR (Hôte)</label>
                        <input
                            type="text"
                            value={config.host}
                            onChange={e => handleChange("host", e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "5px", color: "#7f8c8d", fontSize: "12px", fontWeight: "bold" }}>PORT</label>
                        <input
                            type="text"
                            value={config.port}
                            onChange={e => handleChange("port", e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "5px", color: "#7f8c8d", fontSize: "12px", fontWeight: "bold" }}>NOM DE LA BASE</label>
                        <input
                            type="text"
                            value={config.database}
                            onChange={e => handleChange("database", e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "5px", color: "#7f8c8d", fontSize: "12px", fontWeight: "bold" }}>UTILISATEUR</label>
                        <input
                            type="text"
                            value={config.user}
                            onChange={e => handleChange("user", e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div>
                        <label style={{ display: "block", marginBottom: "5px", color: "#7f8c8d", fontSize: "12px", fontWeight: "bold" }}>MOT DE PASSE</label>
                        <input
                            type="password"
                            value={config.password}
                            onChange={e => handleChange("password", e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>

                {status === "error" && (
                    <div style={{ marginTop: "20px", padding: "10px", background: "#fee", color: "#e74c3c", borderRadius: "5px", fontSize: "12px" }}>
                        <strong>Erreur:</strong><br />{errorMsg}
                    </div>
                )}

                <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
                    <button
                        onClick={testConnection}
                        disabled={status === "testing"}
                        style={{ ...btnStyle, background: "#95a5a6", flex: 1 }}
                    >
                        {status === "testing" ? "Test..." : "Test Connexion"}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={status === "testing"}
                        style={{ ...btnStyle, background: "#27ae60", flex: 1 }}
                    >
                        DÉMARRER 🚀
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputStyle = {
    width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box" as const
};

const btnStyle = {
    padding: "12px", color: "white", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer", fontSize: "14px"
};
