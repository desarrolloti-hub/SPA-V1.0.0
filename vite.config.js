import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/__storage_proxy': {
                target: 'https://firebasestorage.googleapis.com',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/__storage_proxy/, '')
            }
        }
    },
    preview: {
        proxy: {
            '/__storage_proxy': {
                target: 'https://firebasestorage.googleapis.com',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/__storage_proxy/, '')
            }
        }
    }
});
