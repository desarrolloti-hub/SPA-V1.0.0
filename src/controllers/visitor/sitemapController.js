/* ========================================
   SITEMAP CONTROLLER - RSI Enterprise México
   Controlador interactivo del mapa del sitio para visitantes
   ======================================== */

let searchHandler = null;
let chipsHandler = null;

export function sitemapController() {
    console.log('🗺️ Inicializando Sitemap Controller');

    initSitemapSearch();
    initCategoryChips();

    console.log('✅ Sitemap Controller listo');
}

/**
 * 🔍 Búsqueda en tiempo real de páginas y servicios
 */
function initSitemapSearch() {
    const input = document.getElementById('sitemapSearchInput');
    if (!input) return;

    searchHandler = () => {
        const query = (input.value || '').toLowerCase().trim();
        const cards = document.querySelectorAll('.rsi-sitemap-card');
        const activeChip = document.querySelector('.rsi-sitemap-chip.active');
        const activeCategory = activeChip ? activeChip.getAttribute('data-category') : 'all';

        cards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');
            const items = card.querySelectorAll('.rsi-sitemap-item');
            let visibleInCard = 0;

            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
                const matchesSearch = !query || text.includes(query) || keywords.includes(query);
                const matchesCategory = activeCategory === 'all' || cardCategory === activeCategory;

                if (matchesSearch && matchesCategory) {
                    item.classList.remove('hidden');
                    visibleInCard++;
                } else {
                    item.classList.add('hidden');
                }
            });

            // Ocultar tarjeta completa si no tiene enlaces visibles
            if (visibleInCard > 0) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    input.addEventListener('input', searchHandler);
}

/**
 * 🏷️ Filtrado por categoría mediante chips
 */
function initCategoryChips() {
    const chips = document.querySelectorAll('.rsi-sitemap-chip');
    if (!chips.length) return;

    chipsHandler = (e) => {
        const clickedChip = e.currentTarget;
        chips.forEach(c => c.classList.remove('active'));
        clickedChip.classList.add('active');

        // Disparar nuevamente la búsqueda para aplicar el filtro
        const input = document.getElementById('sitemapSearchInput');
        if (input) {
            input.dispatchEvent(new Event('input'));
        }
    };

    chips.forEach(chip => {
        chip.addEventListener('click', chipsHandler);
    });
}
