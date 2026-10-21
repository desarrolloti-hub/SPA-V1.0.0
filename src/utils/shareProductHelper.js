/* ==========================================================================
   SHARE PRODUCT HELPER - RSI Enterprise
   Utilidad unificada para compartir productos por WhatsApp,
   Email, Redes Sociales (Facebook, X, LinkedIn, Telegram) y portapapeles.
   ========================================================================== */

const Swal = window.Swal || {
    fire: (...args) => console.log('Swal:', ...args)
};

/**
 * Actualiza los metadatos Open Graph y Twitter Cards dinámicamente para el producto
 * @param {Object} product
 */
export function updateProductSocialMetaTags(product) {
    if (!product) return;

    const origin = window.location.origin;
    const url = `${origin}/productDetail?id=${encodeURIComponent(product.id)}`;
    const title = product.nombre ? `${product.nombre} | RSI Enterprise` : 'Producto | RSI Enterprise';
    const description = product.descripcion || 'Conoce este equipo de seguridad electrónica y telecomunicaciones en RSI Enterprise.';
    const image = product.imagenPrincipal || product.imagenes?.[0]?.url || `${origin}/assets/icons/logo.png`;

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

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:secure_url', image);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'product');

    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setMeta('name', 'twitter:card', 'summary_large_image');
}

/**
 * Abre un modal interactivo con SweetAlert2 para compartir el producto
 * @param {Object} product
 */
export async function openShareProductModal(product) {
    if (!product || !product.id) return;

    const origin = window.location.origin;
    const publicUrl = `${origin}/productDetail?id=${encodeURIComponent(product.id)}`;
    const title = product.nombre || 'Producto';
    const desc = product.descripcion ? product.descripcion.slice(0, 140) + '...' : 'Equipo disponible en RSI Enterprise.';
    const precio = product.precio 
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(product.precio)
        : '';
    const imgUrl = product.imagenPrincipal || product.imagenes?.[0]?.url || '/assets/images/placeholder.jpg';

    // WhatsApp
    const waText = encodeURIComponent(
        `¡Hola! Te comparto este producto de *RSI Enterprise*:\n\n` +
        `📦 *${title}*\n` +
        (product.modelo ? `🔹 Modelo: ${product.modelo}\n` : '') +
        (precio ? `💰 Precio: *${precio} MXN*\n\n` : '\n') +
        `Consulta todos los detalles y especificaciones aquí:\n${publicUrl}`
    );
    const waUrl = `https://api.whatsapp.com/send?text=${waText}`;

    // Email
    const mailSubject = encodeURIComponent(`Producto recomendado: ${title} — RSI Enterprise`);
    const mailBody = encodeURIComponent(
        `Hola,\n\nTe comparto este equipo de RSI Enterprise:\n\n` +
        `Producto: ${title}\n` +
        (product.modelo ? `Modelo: ${product.modelo}\n` : '') +
        (precio ? `Precio: ${precio} MXN\n` : '') +
        `\nPuedes consultar la ficha técnica y disponibilidad aquí:\n${publicUrl}\n\n` +
        `Saludos cordiales,\nRSI Enterprise\nhttps://rsienterprise.com`
    );
    const mailUrl = `mailto:?subject=${mailSubject}&body=${mailBody}`;

    // Redes
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Conoce ${title} en RSI Enterprise:`)}&url=${encodeURIComponent(publicUrl)}`;
    const inUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`;
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(`${title} — RSI Enterprise:\n${publicUrl}`)}`;

    const hasNativeShare = typeof navigator.share === 'function';

    const htmlContent = `
        <div style="text-align: left; font-family: inherit;">
            <!-- Previsualización del Producto -->
            <div style="display: flex; gap: 14px; align-items: center; background: var(--rsi-bg-secondary, #f8fafc); border: 1px solid var(--rsi-border-color, #e2e8f0); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                <img src="${imgUrl}" alt="${title}" style="width: 70px; height: 70px; object-fit: contain; background: #fff; border-radius: 8px; border: 1.5px solid #D4AF37; flex-shrink: 0; padding: 4px;" />
                <div style="overflow: hidden; flex: 1;">
                    <strong style="display: block; font-size: 0.95rem; color: var(--rsi-text-primary, #0f172a); line-height: 1.25; margin-bottom: 4px;">${title}</strong>
                    <div style="display: flex; gap: 8px; align-items: center; font-size: 0.8rem; color: var(--rsi-text-secondary, #64748b);">
                        <span>${product.marcaNombre || 'RSI'}</span>
                        ${precio ? `<strong style="color: #D4AF37; font-size: 0.9rem;">${precio}</strong>` : ''}
                    </div>
                </div>
            </div>

            <!-- Botón de compartir nativo móvil -->
            ${hasNativeShare ? `
                <button type="button" id="btnNativeShareProduct" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; padding: 11px 16px; border-radius: 8px; font-weight: 700; font-size: 0.92rem; border: none; cursor: pointer; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);">
                    <i class="fab fa-whatsapp" style="font-size: 1.25rem;"></i> Compartir directo (WhatsApp / App)
                </button>
            ` : ''}

            <!-- Canales de Redes -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px;">
                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fab fa-whatsapp" style="font-size: 1.15rem;"></i> WhatsApp
                </a>
                <a href="${mailUrl}" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #0284c7; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fas fa-envelope" style="font-size: 1.05rem;"></i> Correo
                </a>
                <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #1877F2; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fab fa-facebook-f" style="font-size: 1.05rem;"></i> Facebook
                </a>
                <a href="${tgUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #229ED9; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fab fa-telegram-plane" style="font-size: 1.05rem;"></i> Telegram
                </a>
                <a href="${inUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #0A66C2; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fab fa-linkedin-in" style="font-size: 1.05rem;"></i> LinkedIn
                </a>
                <a href="${xUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #000000; color: #ffffff; padding: 10px 14px; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none;">
                    <i class="fab fa-x-twitter" style="font-size: 1.05rem;"></i> X (Twitter)
                </a>
            </div>

            <!-- Copiar Enlace Directo -->
            <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--rsi-text-secondary, #64748b); margin-bottom: 6px;">
                    Enlace directo al producto
                </label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="inputShareProductUrl" value="${publicUrl}" readonly style="flex: 1; padding: 9px 12px; font-size: 0.85rem; border-radius: 8px; border: 1px solid var(--rsi-border-color, #cbd5e1); background: var(--rsi-bg-primary, #ffffff); color: var(--rsi-text-primary, #0f172a); outline: none;" />
                    <button type="button" id="btnCopyProductLink" class="rsi-btn-crud rsi-btn-crud-primary" style="padding: 9px 16px; font-size: 0.85rem; border-radius: 8px; cursor: pointer; white-space: nowrap;">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
            </div>
        </div>
    `;

    await Swal.fire({
        title: '<i class="fas fa-share-alt" style="color: #D4AF37; margin-right: 8px;"></i> Compartir Producto',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'rsi-swal-share-popup',
            htmlContainer: 'rsi-swal-share-container'
        },
        didOpen: () => {
            const copyBtn = document.getElementById('btnCopyProductLink');
            const urlInput = document.getElementById('inputShareProductUrl');

            if (copyBtn && urlInput) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(urlInput.value);
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                        copyBtn.style.background = '#10b981';
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
                            copyBtn.style.background = '';
                        }, 2000);
                    } catch (err) {
                        urlInput.select();
                        document.execCommand('copy');
                        copyBtn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                    }
                });
            }

            const nativeBtn = document.getElementById('btnNativeShareProduct');
            if (nativeBtn && hasNativeShare) {
                nativeBtn.addEventListener('click', async () => {
                    try {
                        await navigator.share({
                            title: title,
                            text: `Consulta este equipo en RSI Enterprise: ${title}${precio ? ` por ${precio}` : ''}`,
                            url: publicUrl
                        });
                    } catch (e) {
                        console.log('Share cancelado o no completado:', e);
                    }
                });
            }
        }
    });
}
