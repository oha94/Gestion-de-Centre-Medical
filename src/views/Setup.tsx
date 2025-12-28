import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SetupService from '../services/SetupService';
import '../styles/Setup.css';

export default function Setup() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        nom_complet: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [validation, setValidation] = useState({
        username: { valid: true, message: '' },
        password: { valid: true, message: '' },
        confirmPassword: { valid: true, message: '' }
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');

        // Real-time validation
        if (name === 'username') {
            const result = SetupService.validateUsername(value);
            setValidation(prev => ({ ...prev, username: result }));
        } else if (name === 'password') {
            const result = SetupService.validatePassword(value);
            setValidation(prev => ({ ...prev, password: result }));

            // Also check confirm password if it's filled
            if (formData.confirmPassword) {
                setValidation(prev => ({
                    ...prev,
                    confirmPassword: {
                        valid: value === formData.confirmPassword,
                        message: value === formData.confirmPassword ? '' : 'Les mots de passe ne correspondent pas'
                    }
                }));
            }
        } else if (name === 'confirmPassword') {
            setValidation(prev => ({
                ...prev,
                confirmPassword: {
                    valid: value === formData.password,
                    message: value === formData.password ? '' : 'Les mots de passe ne correspondent pas'
                }
            }));
        }
    };

    const validateForm = (): boolean => {
        if (!formData.nom_complet.trim()) {
            setError('Veuillez entrer votre nom complet');
            return false;
        }

        const usernameCheck = SetupService.validateUsername(formData.username);
        if (!usernameCheck.valid) {
            setError(usernameCheck.message);
            return false;
        }

        const passwordCheck = SetupService.validatePassword(formData.password);
        if (!passwordCheck.valid) {
            setError(passwordCheck.message);
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Initialize database with defaults
            await SetupService.initializeDatabase();

            // Create admin user
            await SetupService.createInitialAdmin({
                nom_complet: formData.nom_complet,
                username: formData.username,
                email: formData.email || undefined,
                password: formData.password
            });

            // Mark setup as complete
            await SetupService.completeSetup();

            // Move to success step
            setStep(3);
        } catch (err: any) {
            console.error('Setup error:', err);
            setError(err.message || 'Une erreur est survenue lors de la configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = () => {
        navigate('/login');
    };

    const getPasswordStrength = (password: string): string => {
        if (password.length === 0) return '';
        if (password.length < 8) return 'Faible';

        let strength = 0;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        if (strength <= 2) return 'Moyen';
        if (strength === 3) return 'Bon';
        return 'Excellent';
    };

    const passwordStrength = getPasswordStrength(formData.password);

    return (
        <div className="setup-container">
            <div className="setup-card">
                {/* Header */}
                <div className="setup-header">
                    <div className="setup-logo">
                        <span className="logo-icon">🏥</span>
                        <h1>FOCOLARI</h1>
                    </div>
                    <p className="setup-subtitle">Centre Médical - Configuration Initiale</p>
                </div>

                {/* Progress Steps */}
                <div className="setup-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <div className="step-label">Bienvenue</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <div className="step-label">Compte Admin</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <div className="step-label">Terminé</div>
                    </div>
                </div>

                {/* Step 1: Welcome */}
                {step === 1 && (
                    <div className="setup-content">
                        <div className="welcome-section">
                            <h2>👋 Bienvenue !</h2>
                            <p className="welcome-text">
                                Merci d'avoir choisi FOCOLARI pour la gestion de votre centre médical.
                            </p>
                            <p className="welcome-text">
                                Pour commencer, nous allons créer votre compte administrateur.
                                Ce compte vous permettra d'accéder à toutes les fonctionnalités de l'application.
                            </p>

                            <div className="info-box">
                                <span className="info-icon">ℹ️</span>
                                <div>
                                    <strong>Important :</strong> Pour des raisons de sécurité, nous vous recommandons
                                    de modifier vos identifiants après votre première connexion.
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn-primary btn-large"
                            onClick={() => setStep(2)}
                        >
                            Commencer la configuration
                        </button>
                    </div>
                )}

                {/* Step 2: Admin Account Creation */}
                {step === 2 && (
                    <div className="setup-content">
                        <h2>Créer le compte administrateur</h2>
                        <p className="step-description">
                            Remplissez les informations ci-dessous pour créer votre compte administrateur.
                        </p>

                        <form onSubmit={handleSubmit} className="setup-form">
                            {error && (
                                <div className="alert alert-error">
                                    <span className="alert-icon">⚠️</span>
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="nom_complet">
                                    Nom complet <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="nom_complet"
                                    name="nom_complet"
                                    value={formData.nom_complet}
                                    onChange={handleInputChange}
                                    placeholder="Ex: Jean Dupont"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="username">
                                    Nom d'utilisateur <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    placeholder="Ex: admin"
                                    required
                                    disabled={loading}
                                    className={!validation.username.valid ? 'input-error' : ''}
                                />
                                {!validation.username.valid && formData.username && (
                                    <span className="field-error">{validation.username.message}</span>
                                )}
                                <small className="field-hint">
                                    Minimum 3 caractères, lettres, chiffres et underscores uniquement
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">
                                    Email (optionnel)
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Ex: admin@focolari.com"
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">
                                    Mot de passe <span className="required">*</span>
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Minimum 8 caractères"
                                    required
                                    disabled={loading}
                                    className={!validation.password.valid ? 'input-error' : ''}
                                />
                                {formData.password && (
                                    <div className="password-strength">
                                        <span>Force: </span>
                                        <span className={`strength-${passwordStrength.toLowerCase()}`}>
                                            {passwordStrength}
                                        </span>
                                    </div>
                                )}
                                {!validation.password.valid && formData.password && (
                                    <span className="field-error">{validation.password.message}</span>
                                )}
                                <small className="field-hint">
                                    Minimum 8 caractères avec lettres et chiffres
                                </small>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword">
                                    Confirmer le mot de passe <span className="required">*</span>
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Retapez votre mot de passe"
                                    required
                                    disabled={loading}
                                    className={!validation.confirmPassword.valid ? 'input-error' : ''}
                                />
                                {!validation.confirmPassword.valid && formData.confirmPassword && (
                                    <span className="field-error">{validation.confirmPassword.message}</span>
                                )}
                            </div>

                            <div className="security-notice">
                                <span className="notice-icon">🔒</span>
                                <div>
                                    <strong>Rappel de sécurité :</strong> Veuillez mettre à jour ces identifiants
                                    après votre première connexion pour une meilleure sécurité.
                                </div>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setStep(1)}
                                    disabled={loading}
                                >
                                    Retour
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? 'Configuration en cours...' : 'Créer le compte'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="setup-content">
                        <div className="success-section">
                            <div className="success-icon">✅</div>
                            <h2>Configuration terminée !</h2>
                            <p className="success-text">
                                Votre compte administrateur a été créé avec succès.
                            </p>
                            <p className="success-text">
                                Vous pouvez maintenant vous connecter à l'application avec vos identifiants.
                            </p>

                            <div className="credentials-box">
                                <h3>Vos identifiants :</h3>
                                <div className="credential-item">
                                    <strong>Nom d'utilisateur :</strong> {formData.username}
                                </div>
                                <div className="credential-item">
                                    <strong>Mot de passe :</strong> ••••••••
                                </div>
                            </div>

                            <div className="warning-box">
                                <span className="warning-icon">⚠️</span>
                                <div>
                                    <strong>Important :</strong> N'oubliez pas de modifier votre mot de passe
                                    après votre première connexion dans Paramètres → Utilisateurs.
                                </div>
                            </div>

                            <button
                                className="btn-primary btn-large"
                                onClick={handleFinish}
                            >
                                Aller à la page de connexion
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
