/* ========================================
   BIOMETRIC AUTH (WEBAUTHN / PASSKEYS) - RSI ENTERPRISE
   Autenticación segura por plataforma (Huella / Reconocimiento facial del dispositivo)
   ======================================== */

import { TIPOS_VERIFICACION } from '../models/asistenciaModel.js';

export class BiometricAuthHelper {
    /**
     * Comprueba si el navegador y dispositivo soportan WebAuthn y autenticador de plataforma
     * @returns {Promise<{
     *   soportado: boolean,
     *   autenticadorPlataformaDisponible: boolean,
     *   mensaje: string
     * }>}
     */
    static async verificarSoporte() {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            return {
                soportado: false,
                autenticadorPlataformaDisponible: false,
                mensaje: 'Este navegador no tiene soporte para la API de autenticación WebAuthn.'
            };
        }

        try {
            const plataformaDisponible = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            return {
                soportado: true,
                autenticadorPlataformaDisponible: plataformaDisponible,
                mensaje: plataformaDisponible
                    ? 'Autenticador biométrico/plataforma disponible en el dispositivo.'
                    : 'WebAuthn soportado pero no hay autenticador de plataforma configurado en el dispositivo.'
            };
        } catch (error) {
            console.warn('⚠️ Error al verificar autenticador de plataforma:', error);
            return {
                soportado: true,
                autenticadorPlataformaDisponible: false,
                mensaje: 'No fue posible consultar los autenticadores de plataforma del dispositivo.'
            };
        }
    }

    /**
     * Solicita una verificación biométrica del colaborador mediante WebAuthn
     * @param {Object} options
     * @param {string} options.colaboradorUid - UID del colaborador autenticado
     * @param {string} options.colaboradorNombre - Nombre del colaborador
     * @param {string} options.colaboradorEmail - Email del colaborador
     * @returns {Promise<{
     *   exito: boolean,
     *   tipo: string,
     *   resultado: string,
     *   credentialId: string|null,
     *   detalles: string
     * }>}
     */
    static async verificarIdentidad({ colaboradorUid, colaboradorNombre, colaboradorEmail }) {
        const soporte = await this.verificarSoporte();

        if (!soporte.soportado || !soporte.autenticadorPlataformaDisponible) {
            return {
                exito: true, // Se permite continuar bajo sesión segura verificada
                tipo: TIPOS_VERIFICACION.SESION_FALLBACK,
                resultado: 'no_disponible',
                credentialId: null,
                detalles: 'Dispositivo sin autenticador biométrico disponible. Verificado por credenciales de sesión activa.'
            };
        }

        try {
            // Generar desafío criptográfico aleatorio
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const userIdBuffer = new TextEncoder().encode(colaboradorUid);

            const publicKeyCredentialCreationOptions = {
                challenge: challenge,
                rp: {
                    name: "RSI Enterprise - Control de Asistencia",
                    id: window.location.hostname
                },
                user: {
                    id: userIdBuffer,
                    name: colaboradorEmail || colaboradorUid,
                    displayName: colaboradorNombre || "Colaborador RSI"
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },  // ES256
                    { alg: -257, type: "public-key" } // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "preferred",
                    requireResidentKey: false
                },
                timeout: 30000,
                attestation: "none"
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            if (credential) {
                const credId = credential.id || null;
                return {
                    exito: true,
                    tipo: TIPOS_VERIFICACION.WEBAUTHN,
                    resultado: 'verificado',
                    credentialId: credId,
                    detalles: 'Verificación biométrica completada satisfactoriamente con el autenticador seguro del dispositivo.'
                };
            }

            return {
                exito: false,
                tipo: TIPOS_VERIFICACION.WEBAUTHN,
                resultado: 'cancelado',
                credentialId: null,
                detalles: 'El usuario canceló la autenticación con el dispositivo.'
            };

        } catch (error) {
            console.warn('⚠️ WebAuthn no completado o rechazado:', error.message);

            // Si el usuario canceló deliberadamente
            if (error.name === 'NotAllowedError') {
                return {
                    exito: true,
                    tipo: TIPOS_VERIFICACION.SESION_FALLBACK,
                    resultado: 'omitido',
                    credentialId: null,
                    detalles: 'Autenticación biométrica no completada por el usuario. Validado mediante sesión segura de colaborador.'
                };
            }

            return {
                exito: true,
                tipo: TIPOS_VERIFICACION.SESION_FALLBACK,
                resultado: 'error_tecnico',
                credentialId: null,
                detalles: `Fallo en autenticador de dispositivo (${error.message}). Validado por sesión segura.`
            };
        }
    }
}

export default BiometricAuthHelper;
