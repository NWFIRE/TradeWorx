import { Check, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function AutoSaveIndicator({ isSaving, lastSaved }) {
    if (isSaving) {
        return (
            <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
            </div>
        );
    }

    if (lastSaved) {
        return (
            <div className="flex items-center gap-2 text-sm text-green-400">
                <Check className="h-4 w-4" />
                Saved {format(lastSaved, 'h:mm a')}
            </div>
        );
    }

    return null;
}