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
    setDoc
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
     * Incrementa el contador de un tipo específico en 1
     */
    async incrementContador(tipo) {
        try {
            const docRef = doc(db, this.collectionName, tipo);
            const docSnap = await getDoc(docRef);
            
            let nuevoCount = 1;
            if (docSnap.exists()) {
                nuevoCount = (docSnap.data().count || 0) + 1;
                await updateDoc(docRef, { count: nuevoCount });
            } else {
                await setDoc(docRef, { count: 1 });
            }
            
            this.clearCache();
            console.log(`✅ Contador ${tipo} incrementado a: ${nuevoCount}`);
            return nuevoCount;
        } catch (error) {
            console.error('❌ Error incrementando contador:', error);
            throw new Error('Error al incrementar el contador');
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