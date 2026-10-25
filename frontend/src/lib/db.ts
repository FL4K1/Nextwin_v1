import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface HealthLog {
  id: string;
  type: 'biometric' | 'symptom' | 'alert';
  data: {
    metric_type?: string;
    value?: number;
    unit?: string;
    text?: string;
    message?: string;
    source?: string;
    severity?: string;
  };
  timestamp: string;
  synced: boolean;
}

interface NexTwinDB extends DBSchema {
  vitals: {
    key: string;
    value: {
      id: string;
      metric_type: string;
      value: number;
      unit: string;
      timestamp: string;
      synced: boolean;
    };
    indexes: { 'by-timestamp': string; 'by-sync': number };
  };
  alerts: {
    key: string;
    value: {
      id: string;
      type: string;
      message: string;
      timestamp: string;
      severity: string;
      synced: boolean;
    };
    indexes: { 'by-timestamp': string; 'by-sync': number };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      store: 'vitals' | 'alerts';
      data: HealthLog['data'];
      timestamp: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<NexTwinDB>>;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NexTwinDB>('nexttwin-db', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('vitals')) {
          const vitalsStore = db.createObjectStore('vitals', { keyPath: 'id' });
          vitalsStore.createIndex('by-timestamp', 'timestamp');
          vitalsStore.createIndex('by-sync', 'synced');
        }

        if (!db.objectStoreNames.contains('alerts')) {
          const alertsStore = db.createObjectStore('alerts', { keyPath: 'id' });
          alertsStore.createIndex('by-timestamp', 'timestamp');
          alertsStore.createIndex('by-sync', 'synced');
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
};

// --- Helper Functions for useOfflineSync ---

export const getUnsyncedLogs = async (): Promise<HealthLog[]> => {
  const db = await getDB();
  const tx = db.transaction(['vitals', 'alerts'], 'readonly');
  const vitals = await tx.objectStore('vitals').index('by-sync').getAll(IDBKeyRange.only(false as unknown as number)); 
  const alerts = await tx.objectStore('alerts').index('by-sync').getAll(IDBKeyRange.only(false as unknown as number));
  
  return [
    ...vitals.map(v => ({
      id: v.id,
      type: 'biometric' as const,
      data: v,
      timestamp: v.timestamp,
      synced: v.synced
    })), 
    ...alerts.map(a => ({
      id: a.id,
      type: 'alert' as const,
      data: a,
      timestamp: a.timestamp,
      synced: a.synced
    }))
  ];
};

export const markLogSynced = async (id: string, storeName: 'vitals' | 'alerts') => {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const val = await store.get(id);
  if (val) {
    val.synced = true;
    await store.put(val);
  }
  await tx.done;
};

export const addToSyncQueue = async (action: 'CREATE' | 'UPDATE' | 'DELETE', store: 'vitals' | 'alerts', data: HealthLog['data']) => {
  const db = await getDB();
  await db.add('sync_queue', {
    action,
    store,
    data,
    timestamp: Date.now(),
  });
};

export const saveLogOffline = async (log: HealthLog) => {
  const db = await getDB();
  const storeName = log.type === 'biometric' ? 'vitals' : 'alerts';
  
  // Map HealthLog to store structure
  if (log.type === 'biometric') {
    await db.put('vitals', {
      id: log.id,
      metric_type: log.data.metric_type || 'unknown',
      value: log.data.value || 0,
      unit: log.data.unit || '',
      timestamp: log.timestamp,
      synced: false
    });
  } else {
    await db.put('alerts', {
      id: log.id,
      type: log.type,
      message: log.data.text || log.data.message || "Manual symptom log",
      severity: log.data.severity || 'info',
      timestamp: log.timestamp,
      synced: false
    });
  }
  
  // Also add to sync queue for Background Sync
  await addToSyncQueue('CREATE', storeName, log.data);
};
