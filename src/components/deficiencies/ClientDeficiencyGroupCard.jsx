import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, AlertTriangle, Wrench, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const severityConfig = {
    low: { label: "Low", class: "bg-blue-100 text-blue-700 border-blue-200" },
    medium: { label: "Medium", class: "bg-amber-100 text-amber-700 border-amber-200" },
    high: { label: "High", class: "bg-rose-100 text-rose-700 border-rose-200" },
    critical: { label: "Critical", class: "bg-red-100 text-red-700 border-red-200" }
};

const statusConfig = {
    open: { label: "Open", class: "bg-slate-100 text-slate-700" },
    in_progress: { label: "In Progress", class: "bg-blue-100 text-blue-700" },
    resolved: { label: "Resolved", class: "bg-green-100 text-green-700" },
    closed: { label: "Closed", class: "bg-gray-100 text-gray-700" }
};

export default function ClientDeficiencyGroupCard({ client, property, deficiencies, userProfile, onEdit, onCreateWorkOrder, onDelete }) {
    const hasOpenDeficiencies = deficiencies.some(d => d.status === "open" || d.status === "in_progress");
    const openDeficienciesWithoutWorkOrder = deficiencies.filter(d => d.status === "open" && !d.work_order_id);
    const highestSeverity = deficiencies.reduce((max, d) => {
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[d.severity] > severityOrder[max] ? d.severity : max;
    }, "low");

    return (
        <Card className={cn(
            "hover:shadow-lg transition-all",
            hasOpenDeficiencies && "border-l-4 border-l-rose-500"
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-slate-600" />
                            {client?.company_name || "Unknown Client"}
                        </CardTitle>
                        {property && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                                <MapPin className="h-4 w-4" />
                                {property.name}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge className={severityConfig[highestSeverity].class}>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {severityConfig[highestSeverity].label}
                        </Badge>
                        <span className="text-sm font-medium text-slate-600">
                            {deficiencies.length} {deficiencies.length === 1 ? 'Deficiency' : 'Deficiencies'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
                {deficiencies.map((deficiency, index) => (
                    <div 
                        key={deficiency.id}
                        className={cn(
                            "p-3 rounded-lg border bg-slate-50",
                            index !== 0 && "mt-3"
                        )}
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-900">{deficiency.title}</h4>
                                {deficiency.location && (
                                    <p className="text-sm text-slate-600 mt-1">
                                        <MapPin className="h-3 w-3 inline mr-1" />
                                        {deficiency.location}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Badge className={statusConfig[deficiency.status]?.class || statusConfig.open.class}>
                                    {statusConfig[deficiency.status]?.label || "Open"}
                                </Badge>
                                <Badge className={severityConfig[deficiency.severity].class}>
                                    {severityConfig[deficiency.severity].label}
                                </Badge>
                            </div>
                        </div>
                        
                        {deficiency.description && (
                            <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {deficiency.description}
                            </p>
                        )}

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(deficiency)}
                                className="flex-1"
                            >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                            {userProfile?.role === "admin" && onDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDelete(deficiency)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
                
                {openDeficienciesWithoutWorkOrder.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <Button
                            variant="default"
                            onClick={() => onCreateWorkOrder(openDeficienciesWithoutWorkOrder)}
                            className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                            <Wrench className="h-4 w-4 mr-2" />
                            Create Repair for {openDeficienciesWithoutWorkOrder.length} {openDeficienciesWithoutWorkOrder.length === 1 ? 'Deficiency' : 'Deficiencies'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}