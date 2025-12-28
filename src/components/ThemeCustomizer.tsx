import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeService, Theme } from '../services/ThemeService';

export default function ThemeCustomizer() {
    const { theme, setTheme, presets } = useTheme();
    const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
    const [secondaryColor, setSecondaryColor] = useState(theme.secondaryColor);
    const [themeName, setThemeName] = useState(theme.name);

    const handleApplyCustom = () => {
        const newTheme: Theme = {
            name: themeName || 'Custom',
            primaryColor,
            secondaryColor,
            gradient: ThemeService.generateGradient(primaryColor, secondaryColor)
        };
        setTheme(newTheme);
    };

    const handlePresetClick = (preset: Theme) => {
        setPrimaryColor(preset.primaryColor);
        setSecondaryColor(preset.secondaryColor);
        setThemeName(preset.name);
        setTheme(preset);
    };

    const handleReset = () => {
        const defaultTheme = ThemeService.getDefaultTheme();
        setPrimaryColor(defaultTheme.primaryColor);
        setSecondaryColor(defaultTheme.secondaryColor);
        setThemeName(defaultTheme.name);
        setTheme(defaultTheme);
    };

    const previewGradient = ThemeService.generateGradient(primaryColor, secondaryColor);

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h2 style={titleStyle}>🎨 Personnalisation du Thème</h2>
                <p style={subtitleStyle}>Choisissez les couleurs de votre application</p>

                {/* Prévisualisation */}
                <div style={previewContainerStyle}>
                    <div style={previewLabelStyle}>Aperçu</div>
                    <div style={{
                        ...previewBoxStyle,
                        background: previewGradient
                    }}>
                        <div style={previewTextStyle}>Votre thème personnalisé</div>
                        <button style={{
                            ...previewButtonStyle,
                            backgroundColor: primaryColor
                        }}>
                            Bouton Exemple
                        </button>
                    </div>
                </div>

                {/* Color Pickers */}
                <div style={colorPickersContainerStyle}>
                    <div style={colorPickerGroupStyle}>
                        <label style={labelStyle}>Couleur Primaire</label>
                        <div style={colorInputWrapperStyle}>
                            <input
                                type="color"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={colorInputStyle}
                            />
                            <input
                                type="text"
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                style={textInputStyle}
                                placeholder="#667eea"
                            />
                        </div>
                    </div>

                    <div style={colorPickerGroupStyle}>
                        <label style={labelStyle}>Couleur Secondaire</label>
                        <div style={colorInputWrapperStyle}>
                            <input
                                type="color"
                                value={secondaryColor}
                                onChange={(e) => setSecondaryColor(e.target.value)}
                                style={colorInputStyle}
                            />
                            <input
                                type="text"
                                value={secondaryColor}
                                onChange={(e) => setSecondaryColor(e.target.value)}
                                style={textInputStyle}
                                placeholder="#764ba2"
                            />
                        </div>
                    </div>
                </div>

                {/* Nom du thème */}
                <div style={nameInputGroupStyle}>
                    <label style={labelStyle}>Nom du Thème</label>
                    <input
                        type="text"
                        value={themeName}
                        onChange={(e) => setThemeName(e.target.value)}
                        style={nameInputStyle}
                        placeholder="Mon Thème Personnalisé"
                    />
                </div>

                {/* Boutons d'action */}
                <div style={actionsContainerStyle}>
                    <button onClick={handleApplyCustom} style={applyButtonStyle}>
                        ✓ Appliquer
                    </button>
                    <button onClick={handleReset} style={resetButtonStyle}>
                        ↺ Réinitialiser
                    </button>
                </div>

                {/* Séparateur */}
                <div style={separatorStyle}></div>

                {/* Thèmes préinstallés */}
                <h3 style={presetsTitle}>Thèmes Préinstallés</h3>
                <div style={presetsContainerStyle}>
                    {presets.map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => handlePresetClick(preset)}
                            style={{
                                ...presetButtonStyle,
                                background: preset.gradient,
                                border: theme.name === preset.name ? '3px solid #2c3e50' : 'none'
                            }}
                            title={preset.name}
                        >
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.5)',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                backdropFilter: 'blur(4px)'
                            }}>
                                <div style={presetNameStyle}>{preset.name}</div>
                            </div>
                        </button>
                    ))}
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

const previewContainerStyle: React.CSSProperties = {
    marginBottom: '30px'
};

const previewLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#34495e',
    marginBottom: '10px'
};

const previewBoxStyle: React.CSSProperties = {
    borderRadius: '16px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    minHeight: '150px'
};

const previewTextStyle: React.CSSProperties = {
    color: 'white',
    fontSize: '20px',
    fontWeight: '600'
};

const previewButtonStyle: React.CSSProperties = {
    padding: '12px 30px',
    borderRadius: '10px',
    border: 'none',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
};

const colorPickersContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '25px'
};

const colorPickerGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#34495e'
};

const colorInputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
};

const colorInputStyle: React.CSSProperties = {
    width: '60px',
    height: '50px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    cursor: 'pointer'
};

const textInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '15px',
    fontFamily: 'monospace'
};

const nameInputGroupStyle: React.CSSProperties = {
    marginBottom: '25px'
};

const nameInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    fontSize: '15px',
    marginTop: '10px'
};

const actionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '15px',
    marginBottom: '30px'
};

const applyButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '14px',
    background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)',
    transition: 'transform 0.2s'
};

const resetButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '14px',
    background: '#ecf0f1',
    color: '#34495e',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
};

const separatorStyle: React.CSSProperties = {
    height: '1px',
    background: '#ecf0f1',
    margin: '30px 0'
};

const presetsTitle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px'
};

const presetsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '15px'
};

const presetButtonStyle: React.CSSProperties = {
    padding: '50px 20px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s',
    position: 'relative',
    overflow: 'hidden'
};

const presetNameStyle: React.CSSProperties = {
    color: 'white',
    fontSize: '14px',
    fontWeight: '700',
    textShadow: '0 3px 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
    letterSpacing: '0.5px'
};
