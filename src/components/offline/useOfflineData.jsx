import { useState, useEffect } from 'react';
import { syncManager } from './syncManager';
import { offlineStorage } from './offlineStorage';

export function useOfflineData() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const updatePendingSyncs = async () => {
      const syncs = await offlineStorage.getPendingSyncs();
      setPendingSyncs(syncs);
    };

    updatePendingSyncs();

    const unsubscribe = syncManager.addListener((event) => {
      if (event.type === 'SYNC_START') {
        setSyncStatus('syncing');
      } else if (event.type === 'SYNC_COMPLETE') {
        setSyncStatus('complete');
        updatePendingSyncs();
        setTimeout(() => setSyncStatus(null), 3000);
      } else if (event.type === 'SYNC_ERROR') {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus(null), 5000);
      } else if (event.type === 'SYNC_QUEUED') {
        updatePendingSyncs();
      }
    });

    return unsubscribe;
  }, []);

  const queueSync = async (type, data) => {
    await syncManager.queueSync(type, data);
  };

  const manualSync = async () => {
    await syncManager.sync();
  };

  return {
    isOnline,
    pendingSyncs,
    syncStatus,
    queueSync,
    manualSync,
    hasPendingSyncs: pendingSyncs.length > 0
  };
}