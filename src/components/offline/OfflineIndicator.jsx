import React from "react";
import { useOfflineData } from "./useOfflineData";
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function OfflineIndicator() {
  const { isOnline, hasPendingSyncs, syncStatus, manualSync } = useOfflineData();

  if (isOnline && !hasPendingSyncs && syncStatus !== 'syncing') {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 lg:top-4 print:hidden pointer-events-auto">
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm border animate-in slide-in-from-top duration-300",
        !isOnline && "bg-amber-500/90 text-white border-amber-600",
        isOnline && hasPendingSyncs && syncStatus === 'syncing' && "bg-blue-500/90 text-white border-blue-600",
        isOnline && hasPendingSyncs && syncStatus !== 'syncing' && "bg-slate-800/90 text-white border-slate-700",
        syncStatus === 'complete' && "bg-green-500/90 text-white border-green-600",
        syncStatus === 'error' && "bg-red-500/90 text-white border-red-600"
      )}>
        {!isOnline && (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Offline Mode</span>
          </>
        )}
        
        {isOnline && syncStatus === 'syncing' && (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Syncing...</span>
          </>
        )}
        
        {isOnline && hasPendingSyncs && syncStatus !== 'syncing' && (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Changes pending</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={manualSync}
              className="h-6 px-2 text-xs bg-white/20 hover:bg-white/30"
            >
              Sync Now
            </Button>
          </>
        )}
        
        {syncStatus === 'complete' && (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">All changes synced</span>
          </>
        )}
        
        {syncStatus === 'error' && (
          <>
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Sync failed</span>
          </>
        )}
      </div>
    </div>
  );
}