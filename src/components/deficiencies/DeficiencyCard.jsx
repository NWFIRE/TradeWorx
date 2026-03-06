import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
    AlertTriangle,
    MapPin,
    Calendar,
    User,
    CheckCircle2,
    Clock,
    Edit,
    FileText,
    Wrench
} from "lucide-react";

const severityConfig = {
    low: { label: "Low", class: "bg-blue-100 text-blue-700 border-blue-200", icon: "text-blue-600" },
    medium: { label: "Medium", class: "bg-amber-100 text-amber-700 border-amber-200", icon: "text-amber-600" },
    high: { label: "High", class: "bg-rose-100 text-rose-700 border-rose-200", icon: "text-rose-600" },
    critical: { label: "Critical", class: "bg-red-100 text-red-700 border-red-200 animate-pulse", icon: "text-red-600" }
};

const statusConfig = {
    open: { label: "Open", class: "bg-slate-100 text-slate-700 border-slate-200", icon: AlertTriangle },
    in_progress: { label: "In Progress", class: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
    resolved: { label: "Resolved", class: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    closed: { label: "Closed", class: "bg-slate-100 text-slate-600 border-slate-200", icon: CheckCircle2 }
};

const categoryIcons = {
    fire_alarm: "🔔",
    sprinkler_system: "💧",
    fire_extinguisher: "🔥",
    emergency_lighting: "💡",
    kitchen_suppression: "👨‍🍳",
    structural: "🏗️",
    electrical: "⚡",
    other: "📋"
};

export default function DeficiencyCard({ deficiency, property, client, onEdit, onCreateWorkOrder }) {
    const severityInfo = severityConfig[deficiency.severity] || severityConfig.medium;
    const statusInfo = statusConfig[deficiency.status] || statusConfig.open;
    const StatusIcon = statusInfo.icon;
    const isDueToday = deficiency.due_date && new Date(deficiency.due_date).toDateString() === new Date().toDateString();
    const isOverdue = deficiency.due_date && new Date(deficiency.due_date) < new Date();

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all duration-200",
            deficiency.severity === "critical" && "border-red-300"
        )}>
            <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{categoryIcons[deficiency.category] || "📋"}</span>
                                <h3 className="font-bold text-slate-900 text-lg truncate">
                                    {deficiency.title || "Untitled Deficiency"}
                                </h3>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">{deficiency.description}</p>
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="outline" className={cn("border", severityInfo.class)}>
                                {severityInfo.label}
                            </Badge>
                            <Badge variant="outline" className={cn("border", statusInfo.class)}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                            </Badge>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {client && (
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 font-semibold">{client.company_name}</span>
                            </div>
                        )}
                        {property && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">{property.name}</span>
                            </div>
                        )}
                        {deficiency.location && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">{deficiency.location}</span>
                            </div>
                        )}
                        {deficiency.assigned_to_name && (
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">Assigned to {deficiency.assigned_to_name}</span>
                            </div>
                        )}
                        {deficiency.due_date && (
                            <div className="flex items-center gap-2">
                                <Calendar className={cn(
                                    "h-4 w-4",
                                    isOverdue ? "text-red-500" : isDueToday ? "text-amber-500" : "text-slate-400"
                                )} />
                                <span className={cn(
                                    "text-slate-600",
                                    isOverdue && "text-red-600 font-semibold",
                                    isDueToday && "text-amber-600 font-semibold"
                                )}>
                                    Due {format(new Date(deficiency.due_date), "MMM d, yyyy")}
                                    {isOverdue && " (Overdue)"}
                                    {isDueToday && " (Today)"}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Corrective Action */}
                    {deficiency.corrective_action && (
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-600 mb-1">Corrective Action:</p>
                            <p className="text-sm text-slate-900">{deficiency.corrective_action}</p>
                        </div>
                    )}

                    {/* Code Reference */}
                    {deficiency.code_reference && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <FileText className="h-3 w-3" />
                            <span>Code: {deficiency.code_reference}</span>
                        </div>
                    )}

                    {/* Photos */}
                    {deficiency.photos && deficiency.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto">
                            {deficiency.photos.slice(0, 4).map((url, idx) => (
                                <img
                                    key={idx}
                                    src={url}
                                    alt={`Photo ${idx + 1}`}
                                    className="h-16 w-16 object-cover rounded-lg border border-slate-200"
                                />
                            ))}
                            {deficiency.photos.length > 4 && (
                                <div className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs text-slate-600">
                                    +{deficiency.photos.length - 4}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button variant="outline" size="sm" onClick={() => onEdit(deficiency)} className="flex-1">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                        {!deficiency.work_order_id && deficiency.status !== "closed" && (
                            <Button
                                size="sm"
                                onClick={() => onCreateWorkOrder(deficiency)}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
                            >
                                <Wrench className="h-4 w-4 mr-2" />
                                Create Work Order
                            </Button>
                        )}
                        {deficiency.work_order_id && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Work Order Created
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}