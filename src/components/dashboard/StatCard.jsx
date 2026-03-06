import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, href }) {
    const content = (
        <div className="flex items-start justify-between">
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">
                    {title}
                </p>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                    {value}
                </p>
                {subtitle && (
                    <p className="text-sm text-slate-500">{subtitle}</p>
                )}
                {trend && (
                    <div className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                        trendUp ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                        <span>{trend}</span>
                    </div>
                )}
            </div>
            {Icon && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-200">
                    <Icon className="h-6 w-6 text-white" />
                </div>
            )}
        </div>
    );

    if (href) {
        return (
            <Link to={href}>
                <div className={cn(
                    "relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100",
                    "transition-all duration-300 hover:shadow-md hover:border-slate-200 hover:-translate-y-1 cursor-pointer",
                    className
                )}>
                    {content}
                </div>
            </Link>
        );
    }

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100",
            "transition-all duration-300 hover:shadow-md hover:border-slate-200",
            className
        )}>
            {content}
        </div>
    );
}