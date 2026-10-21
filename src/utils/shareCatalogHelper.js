/* ========================================
   SHARE CATALOG HELPER - RSI ENTERPRISE
   Utilidad unificada para compartir catálogos comerciales por WhatsApp,
   Correo Electrónico, Redes Sociales (Facebook, X, LinkedIn, Telegram)
   y portapapeles, actualizando metadatos Open Graph / Twitter Card dinámicamente.
   ======================================== */

/**
 * Actualiza los metadatos Open Graph y Twitter Cards en el <head> del documento
 * para que cuando se comparta el enlace o se inspeccione en el navegador,
 * la imagen de portada, título y descripción correspondan al catálogo.
 * @param {Object} catalog
 */
export function updateCatalogSocialMetaTags(catalog) {
    if (!catalog) return;

    const origin = window.location.origin;
    const url = `${origin}/verCatalogo?id=${catalog.id}`;
    const title = catalog.titulo ? `${catalog.titulo} | Catálogos RSI Enterprise` : 'Catálogo Comercial | RSI Enterprise';
    const description = catalog.descripcion || 'Explora nuestro catálogo oficial de productos y servicios de RSI Enterprise.';
    const image = catalog.imagenPortada || `${origin}/assets/icons/logo.png`;

    document.title = title;

    const setMeta = (attr, val, content) => {
        let el = document.querySelector(`meta[${attr}="${val}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, val);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content);
    };

    // Standard Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:secure_url', image);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');

    // Twitter Card
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setMeta('name', 'twitter:card', 'summary_large_image');
}

/**
 * Abre un modal interactivo con SweetAlert2 para compartir el catálogo
 * a través de múltiples canales (WhatsApp con imagen, Email, Redes Sociales, Copiar Enlace y Copiar Imagen).
 * 
 * La URL compartida siempre apunta a /verCatalogo?id={catalog.id}
 * @param {Object} catalog - Objeto del catálogo ({ id, titulo, descripcion, imagenPortada })
 */
export async function openShareCatalogModal(catalog) {
    if (!catalog || !catalog.id) return;

    const origin = window.location.origin;
    const publicUrl = `${origin}/verCatalogo?id=${encodeURIComponent(catalog.id)}`;
    const title = catalog.titulo || 'Catálogo Comercial';
    const desc = catalog.descripcion || 'Te invito a revisar nuestro catálogo oficial de productos y servicios en RSI Enterprise.';
    const portadaImg = catalog.imagenPortada || '/assets/icons/logo.png';

    // Generar texto optimizado para WhatsApp (1 solo enlace limpio al final para que genere preview)
    const waText = encodeURIComponent(
        `¡Hola! Te comparto nuestro catálogo comercial: *${title}* de RSI Enterprise.\n\n` +
        `${desc}\n\n` +
        `📖 Consulta el catálogo interactivo aquí:\n${publicUrl}`
    );
    const waUrl = `https://api.whatsapp.com/send?text=${waText}`;

    const mailSubject = encodeURIComponent(`Catálogo Comercial: ${title} — RSI Enterprise`);
    const mailBody = encodeURIComponent(
        `Estimado cliente / colaborador:\n\n` +
        `Te compartimos el catálogo comercial "${title}".\n\n` +
        `Descripción:\n${desc}\n\n` +
        `Puedes consultarlo y revisarlo en el siguiente enlace:\n${publicUrl}\n\n` +
        `Saludos cordiales,\nEquipo de RSI Enterprise\nhttps://rsienterprise.com`
    );
    const mailUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;

    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Catálogo ${title} en RSI Enterprise:`)}&url=${encodeURIComponent(publicUrl)}`;
    const inUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(`Catálogo ${title} — RSI Enterprise:\n${publicUrl}`)}`;

    const hasNativeShare = typeof navigator.share === 'function';

    const htmlContent = `
        <div style="text-align: left; font-family: inherit;">
            <!-- Previsualización de Portada y Datos -->
            <div style="display: flex; gap: 14px; align-items: center; background: var(--rsi-bg-secondary, #f8fafc); border: 1px solid var(--rsi-border-color, #e2e8f0); border-radius: 10px; padding: 12px; margin-bottom: 16px;">
                <img src="${portadaImg}" alt="${title}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; border: 1.5px solid #D4AF37; flex-shrink: 0;" />
                <div style="overflow: hidden; flex: 1;">
                    <strong style="display: block; font-size: 0.95rem; color: var(--rsi-text-primary, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</strong>
                    <span style="display: block; font-size: 0.78rem; color: var(--rsi-text-secondary, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${desc}</span>
                    <span style="display: inline-block; font-size: 0.72rem; color: #D4AF37; font-weight: 700; margin-top: 4px;">/verCatalogo?id=${catalog.id}</span>
                </div>
            </div>

            <!-- Botón de compartir nativo (Ideal para WhatsApp móvil con imagen) -->
            ${hasNativeShare ? `
                <button type="button" id="btnNativeShareCatalog" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; padding: 11px 16px; border-radius: 8px; font-weight: 700; font-size: 0.92rem; border: none; cursor: pointer; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);">
                    <i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> Compartir por WhatsApp (con imagen adjunta)
                </button>
            ` : ''}

            <!-- Botones Principales de Redes y Canales -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
                <!-- WhatsApp Directo (Web / App) -->
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fab fa-whatsapp" style="font-size: 1.15rem;"></i> WhatsApp Chat
                </a>

                <!-- Correo Electrónico -->
                <a href="${mailUrl}" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #0284c7; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fas fa-envelope" style="font-size: 1.05rem;"></i> Correo
                </a>

                <!-- Facebook -->
                <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #1877F2; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fab fa-facebook-f" style="font-size: 1.05rem;"></i> Facebook
                </a>

                <!-- Telegram -->
                <a href="${tgUrl}" target="_blank" rel="noopener noreferrer" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #229ED9; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fab fa-telegram-plane" style="font-size: 1.05rem;"></i> Telegram
                </a>

                <!-- LinkedIn -->
                <a href="${inUrl}" target="_blank" rel="noopener noreferrer" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #0A66C2; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fab fa-linkedin-in" style="font-size: 1.05rem;"></i> LinkedIn
                </a>

                <!-- X (Twitter) -->
                <a href="${xUrl}" target="_blank" rel="noopener noreferrer" class="rsi-share-channel-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #000000; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; transition: transform 0.15s ease;">
                    <i class="fab fa-x-twitter" style="font-size: 1.05rem;"></i> X (Twitter)
                </a>
            </div>

            <!-- Acciones de Portada e Imagen (WhatsApp Web) -->
            ${catalog.imagenPortada ? `
                <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                    <button type="button" id="btnCopyCatalogImage" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--rsi-bg-secondary, #f1f5f9); border: 1px solid var(--rsi-border-color, #cbd5e1); color: var(--rsi-text-primary, #0f172a); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                        <i class="fas fa-image" style="color: #D4AF37;"></i> Copiar Portada (Ctrl+V)
                    </button>
                    <a href="${catalog.imagenPortada}" target="_blank" download="portada-${(catalog.titulo || 'catalogo').replace(/[^a-zA-Z0-9]/g, '_')}.jpg" style="display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--rsi-bg-secondary, #f1f5f9); border: 1px solid var(--rsi-border-color, #cbd5e1); color: var(--rsi-text-secondary, #475569); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; text-decoration: none; transition: all 0.2s ease;">
                        <i class="fas fa-download"></i> Descargar Portada
                    </a>
                </div>
            ` : ''}

            <!-- Campo de Copiar Enlace Directo -->
            <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--rsi-text-secondary, #64748b); margin-bottom: 6px;">
                    Enlace directo al catálogo:
                </label>
                <div style="display: flex; gap: 8px;">
                    <input 
                        type="text" 
                        id="shareCatalogUrlInput" 
                        value="${publicUrl}" 
                        readonly 
                        style="flex: 1; padding: 8px 12px; font-size: 0.82rem; font-family: monospace; border: 1.5px solid var(--rsi-border-color, #cbd5e1); border-radius: 6px; background: var(--rsi-bg-input, #ffffff); color: var(--rsi-text-primary, #0f172a);"
                    />
                    <button 
                        type="button" 
                        id="btnCopyShareCatalogLink" 
                        style="background: #D4AF37; color: #000000; border: none; font-weight: 600; font-size: 0.82rem; padding: 8px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: opacity 0.2s ease;"
                    >
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: '<i class="fas fa-share-alt" style="color: #D4AF37;"></i> Compartir Catálogo',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        width: '520px',
        didOpen: () => {
            // 1. Copiar Enlace
            const copyBtn = document.getElementById('btnCopyShareCatalogLink');
            const input = document.getElementById('shareCatalogUrlInput');
            if (copyBtn && input) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        input.select();
                        input.setSelectionRange(0, 99999);
                        await navigator.clipboard.writeText(publicUrl);
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                        copyBtn.style.background = '#22c55e';
                        copyBtn.style.color = '#ffffff';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
                            copyBtn.style.background = '#D4AF37';
                            copyBtn.style.color = '#000000';
                        }, 2200);
                    } catch {
                        document.execCommand('copy');
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                    }
                });
            }

            // 2. Compartir Nativo (WhatsApp con imagen adjunta en móviles)
            const nativeBtn = document.getElementById('btnNativeShareCatalog');
            if (nativeBtn) {
                nativeBtn.addEventListener('click', async () => {
                    nativeBtn.disabled = true;
                    nativeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando WhatsApp...';

                    try {
                        let fileToShare = null;
                        if (catalog.imagenPortada) {
                            try {
                                const imgResp = await fetch(catalog.imagenPortada, { mode: 'cors' });
                                if (imgResp.ok) {
                                    const blob = await imgResp.blob();
                                    const ext = blob.type.includes('png') ? 'png' : 'jpg';
                                    const cleanTitle = (catalog.titulo || 'catalogo').replace(/[^a-zA-Z0-9]/g, '_');
                                    fileToShare = new File([blob], `${cleanTitle}.${ext}`, { type: blob.type || 'image/jpeg' });
                                }
                            } catch (e) {
                                console.warn('No se pudo empaquetar imagen para compartir nativo:', e);
                            }
                        }

                        const shareData = {
                            title: title,
                            text: `¡Hola! Te comparto nuestro catálogo comercial: *${title}* de RSI Enterprise.\n\n${desc}\n\n📖 Consulta el catálogo interactivo aquí:\n${publicUrl}`
                        };

                        if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
                            shareData.files = [fileToShare];
                        } else {
                            shareData.url = publicUrl;
                        }

                        await navigator.share(shareData);
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Error al compartir:', err);
                        }
                    } finally {
                        nativeBtn.disabled = false;
                        nativeBtn.innerHTML = '<i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> Compartir por WhatsApp (con imagen adjunta)';
                    }
                });
            }

            // 3. Copiar Imagen al Portapapeles (Para WhatsApp Web)
            const copyImgBtn = document.getElementById('btnCopyCatalogImage');
            if (copyImgBtn && catalog.imagenPortada) {
                copyImgBtn.addEventListener('click', async () => {
                    copyImgBtn.disabled = true;
                    copyImgBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Copiando imagen...';

                    try {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = catalog.imagenPortada;
                        });

                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                        if (!blob) throw new Error('No se pudo convertir la imagen');

                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);

                        copyImgBtn.innerHTML = '<i class="fas fa-check"></i> ¡Portada copiada!';
                        copyImgBtn.style.background = '#22c55e';
                        copyImgBtn.style.color = '#ffffff';

                        Swal.showValidationMessage(
                            '✅ Portada copiada al portapapeles. Pégala (Ctrl + V) en tu chat de WhatsApp.'
                        );

                        setTimeout(() => {
                            copyImgBtn.innerHTML = '<i class="fas fa-image" style="color: #D4AF37;"></i> Copiar Portada (Ctrl+V)';
                            copyImgBtn.style.background = 'var(--rsi-bg-secondary, #f1f5f9)';
                            copyImgBtn.style.color = 'var(--rsi-text-primary, #0f172a)';
                            copyImgBtn.disabled = false;
                        }, 3000);
                    } catch (err) {
                        console.warn('Error al copiar imagen al portapapeles:', err);
                        // Abrir imagen en pestaña como alternativa
                        window.open(catalog.imagenPortada, '_blank');
                        copyImgBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> Abierta';
                        copyImgBtn.disabled = false;
                    }
                });
            }
        }
    });
}
