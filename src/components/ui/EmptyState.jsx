import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmptyState({ 
    icon: Icon, 
    title, 
    description, 
    action, 
    onAction,
    className 
}) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-16 px-6 text-center",
            className
        )}>
            {Icon && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 mb-6">
                    <Icon className="h-12 w-12 text-slate-400" />
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-500 max-w-sm mb-6">{description}</p>
            {action && (
                <Button 
                    onClick={onAction}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                    {action}
                </Button>
            )}
        </div>
    );
}