/* ========================================
   CONTADOR COTIZACION REPOSITORY
   Conexión a Firebase para gestión de contadores
   ======================================== */

import { 
    db,
    collection,
    getDoc,
    updateDoc,
    doc,
    setDoc,
    runTransaction
} from '../config/firebaseConfig.js';
import BaseRepository from './baseRepository.js';

export class ContadorCotizacionRepository extends BaseRepository {
    
    constructor() {
        super('contadoresCotizaciones', 60000);
    }

    /**
     * Obtiene el contador de un tipo específico
     */
    async getContador(tipo) {
        try {
            const docRef = doc(db, this.collectionName, tipo);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return {
                    tipo: docSnap.id,
                    count: docSnap.data().count || 0
                };
            }
            
            // Si no existe, crear uno nuevo con count 0
            await setDoc(docRef, { count: 0 });
            return {
                tipo: tipo,
                count: 0
            };
        } catch (error) {
            console.error('❌ Error obteniendo contador:', error);
            return { tipo, count: 0 };
        }
    }

    /**
     * Incrementa el contador de un tipo específico en 1 de forma atómica transaccional
     */
    async incrementContador(tipo) {
        try {
            const docRef = doc(db, this.collectionName, tipo);
            const nuevoCount = await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                let count = 1;
                if (docSnap.exists()) {
                    count = (docSnap.data().count || 0) + 1;
                    transaction.update(docRef, { count });
                } else {
                    transaction.set(docRef, { count: 1 });
                }
                return count;
            });
            
            this.clearCache();
            console.log(`✅ Contador ${tipo} incrementado atómicamente a: ${nuevoCount}`);
            return nuevoCount;
        } catch (error) {
            console.error('❌ Error incrementando contador atómicamente:', error);
            throw new Error('Error al incrementar el contador: ' + error.message);
        }
    }

    /**
     * Establece el contador a un valor específico
     */
    async setContador(tipo, count) {
        try {
            const docRef = doc(db, this.collectionName, tipo);
            await setDoc(docRef, { count: count }, { merge: true });
            this.clearCache();
            console.log(`✅ Contador ${tipo} establecido a: ${count}`);
            return count;
        } catch (error) {
            console.error('❌ Error estableciendo contador:', error);
            throw new Error('Error al establecer el contador');
        }
    }
}

export default ContadorCotizacionRepository;