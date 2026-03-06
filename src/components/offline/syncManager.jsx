import { base44 } from "@/api/base44Client";
import { offlineStorage } from "./offlineStorage";

class SyncManager {
  constructor() {
    this.syncing = false;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(event) {
    this.listeners.forEach(listener => listener(event));
  }

  async sync() {
    if (this.syncing) return;
    
    this.syncing = true;
    this.notify({ type: 'SYNC_START' });

    try {
      const pendingSyncs = await offlineStorage.getPendingSyncs();
      
      for (const sync of pendingSyncs) {
        try {
          await this.processSync(sync);
          await offlineStorage.removePendingSync(sync.id);
          this.notify({ 
            type: 'SYNC_ITEM_SUCCESS', 
            syncId: sync.id,
            syncType: sync.type 
          });
        } catch (error) {
          console.error('Failed to sync item:', sync, error);
          this.notify({ 
            type: 'SYNC_ITEM_ERROR', 
            syncId: sync.id,
            error: error.message 
          });
        }
      }

      this.notify({ type: 'SYNC_COMPLETE', count: pendingSyncs.length });
    } catch (error) {
      console.error('Sync error:', error);
      this.notify({ type: 'SYNC_ERROR', error: error.message });
    } finally {
      this.syncing = false;
    }
  }

  async processSync(sync) {
    const { type, data } = sync;

    switch (type) {
      case 'create_inspection':
        await base44.entities.Inspection.create(data);
        break;
      
      case 'update_inspection':
        await base44.entities.Inspection.update(data.id, data.updates);
        break;
      
      case 'create_fire_extinguisher':
        await base44.entities.FireExtinguisher.create(data);
        break;
      
      case 'update_fire_extinguisher':
        await base44.entities.FireExtinguisher.update(data.id, data.updates);
        break;
      
      case 'create_fire_alarm_report':
        await base44.entities.FireAlarmReport.create(data);
        break;
      
      case 'update_fire_alarm_report':
        await base44.entities.FireAlarmReport.update(data.id, data.updates);
        break;
      
      case 'create_wet_chemical_report':
        await base44.entities.WetChemicalSystemReport.create(data);
        break;
      
      case 'update_wet_chemical_report':
        await base44.entities.WetChemicalSystemReport.update(data.id, data.updates);
        break;
      
      case 'create_emergency_light_report':
        await base44.entities.EmergencyLightReport.create(data);
        break;
      
      case 'update_emergency_light_report':
        await base44.entities.EmergencyLightReport.update(data.id, data.updates);
        break;
      
      case 'create_wet_sprinkler_report':
        await base44.entities.WetSprinklerReport.create(data);
        break;
      
      case 'update_wet_sprinkler_report':
        await base44.entities.WetSprinklerReport.update(data.id, data.updates);
        break;
      
      case 'upload_photo':
        const file = this.dataURLtoFile(data.photoData, data.filename);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        // Update the inspection with the photo URL
        const inspection = await base44.entities.Inspection.get(data.inspectionId);
        const photos = inspection.photos || [];
        await base44.entities.Inspection.update(data.inspectionId, {
          photos: [...photos, file_url]
        });
        
        // Remove from offline storage
        await offlineStorage.removeOfflinePhoto(data.photoId);
        break;
      
      default:
        console.warn('Unknown sync type:', type);
    }
  }

  dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  async queueSync(type, data) {
    await offlineStorage.addPendingSync(type, data);
    this.notify({ type: 'SYNC_QUEUED', syncType: type });
    
    // Try to sync if online
    if (navigator.onLine) {
      this.sync();
    }
  }
}

export const syncManager = new SyncManager();

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncManager.sync();
  });

  // Listen for service worker sync events
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_REQUESTED') {
        syncManager.sync();
      }
    });
  }
}