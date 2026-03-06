import { useEffect, useRef, useState } from 'react';
import { offlineStorage } from '../offline/offlineStorage';

export function useAutoSave({ 
    data, 
    reportIdRef, 
    saveInFlightRef, 
    saveFunction, 
    localKey,
    options = {} 
}) {
    const { delay = 3000, enabled = true } = options;
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const saveTimeoutRef = useRef(null);
    const previousDataRef = useRef(null);
    const latestDataRef = useRef(data);

    // Always keep latest data in ref
    useEffect(() => {
        latestDataRef.current = data;
    }, [data]);

    // Rule 4: Always save to local storage for offline fallback
    useEffect(() => {
        if (!data || !localKey) return;
        offlineStorage.cacheData(localKey, data);
    }, [data, localKey]);

    useEffect(() => {
        if (!enabled || !data) return;

        // Rule 2: Only save when something changed
        const dataString = JSON.stringify(data);
        if (dataString === previousDataRef.current) return;
        previousDataRef.current = dataString;

        // Rule 2: Debounce - clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Rule 2: Set new debounced timeout
        saveTimeoutRef.current = setTimeout(async () => {
            // Rule 3: Never overlap saves (in-flight lock)
            if (saveInFlightRef.current) return;
            
            saveInFlightRef.current = true;
            setIsSaving(true);
            
            try {
                // Use latest data from ref to avoid stale closures
                const result = await saveFunction(latestDataRef.current);
                
                // Rule 3: Ensure stable report ID (never double-create)
                if (result?.id && !reportIdRef.current) {
                    reportIdRef.current = result.id;
                }
                
                setLastSaved(new Date());
                // Rule 1: Silent - no toast on success
            } catch (error) {
                console.error('Autosave failed:', error);
                // Only show error toasts, not success
            } finally {
                setIsSaving(false);
                saveInFlightRef.current = false;
            }
        }, delay);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, enabled, delay]);

    return { isSaving, lastSaved };
}