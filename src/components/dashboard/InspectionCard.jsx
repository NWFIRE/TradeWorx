import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, ArrowRight, Building2, Bell, Droplets, Flame, Lightbulb, DoorClosed, ChefHat, Activity, ClipboardCheck, FileText, AlertTriangle, RefreshCw, CheckCircle, Briefcase, Trash2, Download, Wrench, ClipboardList, Star } from "lucide-react";
import { format, startOfMonth, isBefore, parse, isSameMonth, addDays, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const reportTypeConfig = {
    fire_alarm: { label: "Fire Alarm", icon: Bell, color: "bg-[#FF000D]" },
    sprinkler_system: { label: "Sprinkler", icon: Droplets, color: "bg-[#B0E0E6]" },
    fire_extinguisher: { label: "Extinguisher", icon: Flame, color: "bg-[#FF7F00]" },
    emergency_lighting: { label: "Emergency Lighting", icon: Lightbulb, color: "bg-[#DDB022]" },
    fire_door: { label: "Fire Door", icon: DoorClosed, color: "bg-purple-500" },
    kitchen_suppression: { label: "Kitchen Suppression", icon: ChefHat, color: "bg-blue-500" },
    fire_pump: { label: "Fire Pump", icon: Activity, color: "bg-teal-500" },
    pdf_upload: { label: "PDF Upload", icon: FileText, color: "bg-slate-500" },
    work_order: { label: "Work Order", icon: ClipboardList, color: "bg-slate-500" }
};

const statusConfig = {
    scheduled: { label: "Scheduled", class: "bg-blue-50 text-blue-700 border-blue-200" },
    to_be_completed: { label: "To Be Completed", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    in_progress: { label: "In Progress", class: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "Completed", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "Cancelled", class: "bg-slate-50 text-slate-700 border-slate-200" },
    requires_followup: { label: "Follow-up", class: "bg-purple-50 text-purple-700 border-purple-200" },
    invoiced: { label: "Invoiced", class: "bg-red-50 text-red-700 border-red-200" }
};

const resultConfig = {
    pass: { label: "Pass", class: "bg-emerald-500" },
    fail: { label: "Fail", class: "bg-rose-500" },
    conditional: { label: "Conditional", class: "bg-amber-500" },
    pending: { label: "Pending", class: "bg-slate-400" }
};

export default function InspectionCard({ inspection, property, client, allClients, userProfile, onReassign, onDelete }) {
    const [isEditingClient, setIsEditingClient] = React.useState(false);
    const [isReassigning, setIsReassigning] = React.useState(false);
    const [selectedClientId, setSelectedClientId] = React.useState(inspection.client_id);
    const [isTogglingPriority, setIsTogglingPriority] = React.useState(false);
    
    React.useEffect(() => {
        setSelectedClientId(inspection.client_id);
    }, [inspection.client_id]);
    
    const status = statusConfig[inspection.status] || statusConfig.scheduled;
    const result = resultConfig[inspection.overall_result] || resultConfig.pending;
    const reportTypes = inspection.report_types || [];
    const primaryReportType = reportTypes[0] || "fire_extinguisher";
    const reportType = reportTypeConfig[primaryReportType] || reportTypeConfig.fire_extinguisher;
    const ReportIcon = reportType.icon;
    
    // Check if there are any deficiencies
    const hasDeficiencies = inspection.deficiencies && inspection.deficiencies.length > 0;
    
    // Check if customer can be changed (admin only, scheduled or completed)
    const canEditClient = userProfile?.role === "admin" && 
                         (inspection.status === "scheduled" || inspection.status === "completed");
    
    const handleClientChange = async (newClientId) => {
        if (!newClientId || newClientId === inspection.client_id) {
            setIsEditingClient(false);
            return;
        }
        
        setIsReassigning(true);
        
        try {
            const { data: result } = await base44.functions.invoke('adminReassignInspectionClient', {
                inspectionId: inspection.id,
                newClientId
            });
            setSelectedClientId(newClientId);
            toast.success(result.message || "Customer reassigned successfully");
            if (onReassign) await onReassign();
            setIsEditingClient(false);
        } catch (error) {
            toast.error(error.message || "Failed to reassign customer");
        } finally {
            setIsReassigning(false);
        }
    };
    
    const handleTogglePriority = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsTogglingPriority(true);
        try {
            await base44.entities.Inspection.update(inspection.id, {
                is_priority: !inspection.is_priority
            });
            toast.success(inspection.is_priority ? "Priority removed" : "Marked as priority");
            if (onReassign) await onReassign(); // Trigger refresh
        } catch (error) {
            toast.error("Failed to update priority status");
        } finally {
            setIsTogglingPriority(false);
        }
    };
    
    const isCompleted = inspection.status === "completed" || inspection.status === "invoiced";
    const isCallIn = inspection.inspection_type === "call_in";
    const isDeficiencyFollowUp = inspection.inspection_type === "followup";
    const isMonthly = inspection.inspection_type === "monthly";
    
    // Check if inspection is overdue (35 days past due date)
    const isOverdue = inspection.status === 'scheduled' && inspection.scheduled_date && (() => {
        const today = new Date();
        let scheduledDate;
        if (inspection.scheduled_date.length === 7) { // YYYY-MM format
            scheduledDate = parse(inspection.scheduled_date, 'yyyy-MM', new Date());
            const overdueThreshold = addDays(endOfMonth(scheduledDate), 35);
            return isBefore(overdueThreshold, today);
        } else { // YYYY-MM-DD format
            scheduledDate = parse(inspection.scheduled_date, 'yyyy-MM-dd', new Date());
            const overdueThreshold = addDays(scheduledDate, 35);
            return isBefore(overdueThreshold, today);
        }
    })();
    
    return (
        <div className={cn(
            "group relative bg-white rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
            inspection.is_priority && !isCompleted
                ? "border-2 border-pink-500 shadow-lg shadow-pink-200 bg-pink-50"
                : isDeficiencyFollowUp
                ? "border-yellow-500 border-2 shadow-md shadow-yellow-500/20 ring-2 ring-yellow-500/10 bg-yellow-50"
                : isCallIn 
                ? "border-green-500 border-2 shadow-md shadow-green-500/20 ring-2 ring-green-500/10 bg-green-50"
                : isMonthly
                ? "border-blue-400 border-2 shadow-md shadow-blue-500/20 ring-2 ring-blue-500/10 bg-blue-50"
                : isOverdue
                ? "border-rose-300 border-2 shadow-md shadow-rose-500/20 ring-2 ring-rose-500/10"
                : "border-slate-100 hover:border-slate-200"
        )}>
            {inspection.is_priority && !isCompleted && (
                <div className="absolute -top-2 -right-2 bg-pink-500 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg z-10">
                    <AlertTriangle className="h-3 w-3" />
                    PRIORITY
                </div>
            )}
            {isDeficiencyFollowUp && (
                <div className="absolute -top-2 -left-2 bg-yellow-500 rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-white" />
                    <span className="text-xs font-bold text-white uppercase">Deficiency Repair</span>
                </div>
            )}
            {isCallIn && !isDeficiencyFollowUp && (
                <div className="absolute -top-2 -left-2 bg-green-600 rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-white" />
                    <span className="text-xs font-bold text-white uppercase">Call-In</span>
                </div>
            )}
            {isMonthly && !isCallIn && !isDeficiencyFollowUp && (
                <div className="absolute -top-2 -left-2 bg-blue-500 rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-white" />
                    <span className="text-xs font-bold text-white uppercase">Monthly</span>
                </div>
            )}
            {isOverdue && !isCallIn && !isDeficiencyFollowUp && !isMonthly && (
                <div className="absolute -top-2 -left-2 bg-rose-500 rounded-full px-2.5 py-0.5 shadow-lg flex items-center gap-1">
                    <Clock className="h-3 w-3 text-white" />
                    <span className="text-xs font-bold text-white uppercase">Overdue</span>
                </div>
            )}
            {hasDeficiencies && (
                <div className="absolute -top-2 -right-2 bg-rose-500 rounded-full p-1.5 shadow-lg">
                    <AlertTriangle className="h-4 w-4 text-white" />
                </div>
            )}
            {inspection.status === "requires_followup" && (
                <div className="absolute -top-2 -right-2 bg-black text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg font-black text-sm z-10">
                    !
                </div>
            )}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isDeficiencyFollowUp ? 'bg-purple-500' : reportType.color}`}>
                        {isDeficiencyFollowUp ? (
                            <Wrench className="h-5 w-5 text-white" />
                        ) : (
                            <ReportIcon className="h-5 w-5 text-white" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("text-xs border", status.class)}>
                                {status.label}
                            </Badge>
                        </div>
                        {isEditingClient ? (
                            <Select 
                                value={selectedClientId} 
                                onValueChange={handleClientChange}
                                disabled={isReassigning}
                            >
                                <SelectTrigger className="h-7 text-xs mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {allClients?.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.company_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div>
                                <div className="flex items-center gap-1">
                                    <p className="text-sm text-slate-700 font-semibold">
                                        {allClients?.find(c => c.id === selectedClientId)?.company_name || client?.company_name || "Client"}
                                    </p>
                                    {canEditClient && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setIsEditingClient(true);
                                            }}
                                            className="h-5 w-5 p-0 text-slate-400 hover:text-orange-600"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                                {inspection.property_name && (
                                    <p className="text-sm text-slate-600 mt-1">
                                        {inspection.property_name}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="space-y-2 mb-4">
                {(property?.address || client?.address) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{property?.address || client?.address}</span>
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>
                            {inspection.scheduled_date 
                                ? inspection.scheduled_date.length === 7
                                    ? format(parse(inspection.scheduled_date, 'yyyy-MM', new Date()), "MMM yyyy")
                                    : format(parse(inspection.scheduled_date, 'yyyy-MM-dd', new Date()), "MMM d, yyyy")
                                : "Not scheduled"}
                        </span>
                    </div>
                    {inspection.scheduled_time && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>{inspection.scheduled_time}</span>
                        </div>
                    )}
                </div>
                {inspection.notes && inspection.notes.trim() !== '' && (() => {
                    const pdfMatch = inspection.notes.match(/Attached PDF:\s*(https?:\/\/\S+)/);
                    const pdfUrl = pdfMatch?.[1]?.trim();

                    if (pdfUrl) {
                        const downloadUrl = inspection.signed_pdf || pdfUrl;
                        return (
                            <div className="mt-2">
                                <a href={downloadUrl} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                                        <FileText className="h-3 w-3" />
                                        {inspection.signed_pdf ? 'Download Signed PDF' : 'Download Attached PDF'}
                                    </Button>
                                </a>
                            </div>
                        );
                    } else if (!inspection.notes.trim().startsWith('{') && !inspection.notes.trim().startsWith('[')) {
                        // Filter out base64 image data and legacy signature lines
                        const cleanedNote = inspection.notes
                            .split('\n')
                            .filter(line => !line.startsWith('data:image/') && !line.match(/^Fire Extinguisher Survey - Customer (Name|Signature):/))
                            .join('\n')
                            .trim();
                        if (!cleanedNote) return null;
                        return (
                            <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100 max-h-20 overflow-hidden">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Notes:</p>
                                <p className="line-clamp-3">{cleanedNote}</p>
                            </div>
                        );
                    }
                    return null;
                })()}

                {property?.notes && property.notes.trim() !== '' && (
                    <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-100 max-h-20 overflow-hidden">
                        <p className="line-clamp-3"><strong>Property Note:</strong> {property.notes}</p>
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                    {reportTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {reportTypes.map(type => {
                                const config = reportTypeConfig[type];
                                if (!config) return null;
                                const TypeIcon = config.icon;
                                return (
                                    <div 
                                        key={type} 
                                        className={cn("p-1.5 rounded-md", config.color)}
                                        title={config.label}
                                    >
                                        <TypeIcon className="h-3.5 w-3.5 text-white" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {userProfile?.role === "admin" && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={handleTogglePriority}
                            disabled={isTogglingPriority}
                            className={cn(
                                "hover:bg-pink-50",
                                inspection.is_priority 
                                    ? "text-pink-600 hover:text-pink-700" 
                                    : "text-slate-400 hover:text-pink-600"
                            )}
                            title={inspection.is_priority ? "Remove priority" : "Mark as priority"}
                        >
                            <Star className={cn("h-4 w-4", inspection.is_priority && "fill-pink-600")} />
                        </Button>
                    )}
                    {userProfile?.role === "admin" && onDelete && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                                e.preventDefault();
                                onDelete(inspection);
                            }}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Link to={createPageUrl(`InspectionDetails?id=${inspection.id}`)}>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-600 hover:text-orange-600 hover:bg-orange-50 gap-1 group-hover:gap-2 transition-all"
                        >
                            View Details
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}