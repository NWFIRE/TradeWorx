import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    Building2,
    MapPin,
    Calendar,
    Clock,
    User,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Plus,
    Trash2,
    Save,
    Camera,
    FileText,
    Loader2,
    Bell,
    Droplets,
    Flame,
    Lightbulb,
    DoorClosed,
    ChefHat,
    Activity,
    ClipboardCheck,
    File,
    Download,
    RefreshCw
} from "lucide-react";
import { reportTypeConfig } from "@/components/inspections/ReportTypeChecklists";
import PDFAnnotator from "@/components/inspections/PDFAnnotator";
import PDFSigningFlow from "@/components/inspections/PDFSigningFlow";
import PDFViewer from "@/components/inspections/PDFViewer";

const statusConfig = {
    scheduled: { label: "Scheduled", class: "bg-blue-50 text-blue-700 border-blue-200" },
    to_be_completed: { label: "To Be Completed", class: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    in_progress: { label: "In Progress", class: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "Completed", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "Cancelled", class: "bg-slate-50 text-slate-700 border-slate-200" },
    requires_followup: { label: "Follow-up", class: "bg-purple-50 text-purple-700 border-purple-200" },
    invoiced: { label: "Invoiced", class: "bg-indigo-50 text-indigo-700 border-indigo-200" }
};

const resultConfig = {
    pass: { label: "Pass", class: "bg-emerald-500", icon: CheckCircle2 },
    fail: { label: "Fail", class: "bg-rose-500", icon: XCircle },
    conditional: { label: "Conditional", class: "bg-amber-500", icon: AlertTriangle },
    pending: { label: "Pending", class: "bg-slate-400", icon: Clock }
};

const reportTypeIcons = {
    fire_alarm: Bell,
    sprinkler_system: Droplets,
    fire_extinguisher: Flame,
    emergency_lighting: Lightbulb,
    fire_door: DoorClosed,
    kitchen_suppression: ChefHat,
    fire_pump: Activity,
    pdf_upload: FileText
};

export default function InspectionDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    const queryClient = useQueryClient();

    const [deficiencies, setDeficiencies] = useState([]);
    const [notes, setNotes] = useState("");
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [status, setStatus] = useState("scheduled");
    const [isSaving, setIsSaving] = useState(false);
    const [showReassignDialog, setShowReassignDialog] = useState(false);
    const [newClientId, setNewClientId] = useState("");
    const [userProfile, setUserProfile] = useState(null);
    const [originalStatus, setOriginalStatus] = useState("scheduled");
    const [newReportTypeToAdd, setNewReportTypeToAdd] = useState("");
    const [isAddingReportType, setIsAddingReportType] = useState(false);
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [uploadingPdf, setUploadingPdf] = useState(false);

    const { data: inspection, isLoading: loadingInspection } = useQuery({
        queryKey: ['inspection', inspectionId],
        queryFn: () => base44.entities.Inspection.filter({ id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: properties = [] } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const { data: extinguishers = [] } = useQuery({
        queryKey: ['extinguishers', inspectionId],
        queryFn: () => base44.entities.FireExtinguisher.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: wetChemicalReports = [] } = useQuery({
        queryKey: ['wetChemicalReports', inspectionId],
        queryFn: () => base44.entities.WetChemicalSystemReport.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: fireAlarmReports = [] } = useQuery({
        queryKey: ['fireAlarmReports', inspectionId],
        queryFn: () => base44.entities.FireAlarmReport.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: emergencyLightReports = [] } = useQuery({
        queryKey: ['emergencyLightReports', inspectionId],
        queryFn: () => base44.entities.EmergencyLightReport.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: wetSprinklerReports = [] } = useQuery({
        queryKey: ['wetSprinklerReports', inspectionId],
        queryFn: () => base44.entities.WetSprinklerReport.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: workOrderParts = [] } = useQuery({
        queryKey: ['workOrderParts', inspectionId],
        queryFn: () => base44.entities.WorkOrderPart.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    // Real-time subscriptions for live updates
    useEffect(() => {
        if (!inspectionId) return;

        const unsubInspection = base44.entities.Inspection.subscribe((event) => {
            if (event.id === inspectionId) {
                queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            }
        });

        const unsubExtinguishers = base44.entities.FireExtinguisher.subscribe((event) => {
            if (event.data?.inspection_id === inspectionId) {
                queryClient.invalidateQueries({ queryKey: ['extinguishers', inspectionId] });
            }
        });

        const unsubWetChem = base44.entities.WetChemicalSystemReport.subscribe((event) => {
            if (event.data?.inspection_id === inspectionId) {
                queryClient.invalidateQueries({ queryKey: ['wetChemicalReports', inspectionId] });
            }
        });

        const unsubEmergencyLight = base44.entities.EmergencyLightReport.subscribe((event) => {
            if (event.data?.inspection_id === inspectionId) {
                queryClient.invalidateQueries({ queryKey: ['emergencyLightReports', inspectionId] });
            }
        });

        const unsubWetSprinkler = base44.entities.WetSprinklerReport.subscribe((event) => {
            if (event.data?.inspection_id === inspectionId) {
                queryClient.invalidateQueries({ queryKey: ['wetSprinklerReports', inspectionId] });
            }
        });

        return () => {
            unsubInspection();
            unsubExtinguishers();
            unsubWetChem();
            unsubEmergencyLight();
            unsubWetSprinkler();
        };
    }, [inspectionId, queryClient]);

    const currentInspection = inspection?.[0];
    const property = properties.find(p => p.id === currentInspection?.property_id);
    const client = clients.find(c => c.id === currentInspection?.client_id);

    // Strip base64 image data and legacy signature lines from notes
    const cleanNotes = (rawNotes) => {
        if (!rawNotes) return "";
        return rawNotes
            .split('\n')
            .filter(line => !line.startsWith('data:image/') && !line.match(/^Fire Extinguisher Survey - Customer (Name|Signature):/))
            .join('\n')
            .trim();
    };

    useEffect(() => {
        if (currentInspection) {
                  setNotes(cleanNotes(currentInspection.notes || ""));
                  const initialStatus = currentInspection.status || "scheduled";
                  setStatus(initialStatus);
                  setOriginalStatus(initialStatus);
                  setDeficiencies(currentInspection.deficiencies || []);
                  setScheduledDate(currentInspection.scheduled_date || "");
                  setScheduledTime(currentInspection.scheduled_time || "");
              }
          }, [currentInspection]);

    useEffect(() => {
        const loadUserProfile = async () => {
            try {
                const user = await base44.auth.me();
                if (user) {
                    const profiles = await base44.entities.UserProfile.list();
                    const profile = profiles.find(p => p.user_id === user.id);
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error("Error loading user profile:", err);
            }
        };
        loadUserProfile();
    }, []);

    const updateMutation = useMutation({
        mutationFn: (data) => base44.entities.Inspection.update(inspectionId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
            toast.success("Inspection saved successfully");
            setIsSaving(false);
        },
        onError: () => {
            setIsSaving(false);
        }
    });

    const addReportTypeMutation = useMutation({
        mutationFn: async (reportType) => {
            if (!currentInspection) throw new Error("Inspection not loaded");
            
            // Update report types
            const updatedReportTypes = [...(currentInspection.report_types || []), reportType];
            await base44.entities.Inspection.update(inspectionId, { report_types: updatedReportTypes });
            
            // Create corresponding report entity
            const baseReportData = {
                inspection_id: inspectionId,
                property_id: currentInspection.property_id,
                client_id: currentInspection.client_id,
                service_date: currentInspection.scheduled_date
            };
            
            switch(reportType) {
                case 'fire_alarm':
                    await base44.entities.FireAlarmReport.create(baseReportData);
                    break;
                case 'emergency_lighting':
                    await base44.entities.EmergencyLightReport.create({
                        ...baseReportData,
                        light_locations: []
                    });
                    break;
                case 'kitchen_suppression':
                    await base44.entities.WetChemicalSystemReport.create({
                        ...baseReportData,
                        service_time: currentInspection.scheduled_time || ""
                    });
                    break;
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            await queryClient.refetchQueries({ queryKey: ['inspection', inspectionId] });
            queryClient.invalidateQueries({ queryKey: ['fireAlarmReports', inspectionId] });
            queryClient.invalidateQueries({ queryKey: ['emergencyLightReports', inspectionId] });
            queryClient.invalidateQueries({ queryKey: ['wetSprinklerReports', inspectionId] });
            queryClient.invalidateQueries({ queryKey: ['wetChemicalReports', inspectionId] });
            toast.success("Report type and report created successfully");
            setNewReportTypeToAdd("");
            setIsAddingReportType(false);
        },
        onError: (error) => {
            toast.error("Failed to add report type: " + error.message);
            setIsAddingReportType(false);
        }
    });

    const removeReportTypeMutation = useMutation({
        mutationFn: async (reportType) => {
            if (!currentInspection) throw new Error("Inspection not loaded");
            const updatedReportTypes = (currentInspection.report_types || []).filter(t => t !== reportType);
            await base44.entities.Inspection.update(inspectionId, { report_types: updatedReportTypes });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            await queryClient.refetchQueries({ queryKey: ['inspection', inspectionId] });
            toast.success("Report type removed successfully");
        },
        onError: (error) => {
            toast.error("Failed to remove report type: " + error.message);
        }
    });

    const handleSave = async () => {
        setIsSaving(true);
        
        const updateData = {
            deficiencies: deficiencies,
            notes: notes,
            status: status,
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            completed_date: status === "completed" ? format(new Date(), "yyyy-MM-dd") : null,
            is_priority: status === "completed" ? false : currentInspection.is_priority
        };
        
        // Create separate Deficiency entities for tracking
        if (deficiencies.length > 0) {
            try {
                // Get existing deficiency entities for this inspection
                const existingDeficiencies = await base44.entities.Deficiency.filter({
                    inspection_id: inspectionId
                });
                
                for (const def of deficiencies) {
                    // Check if this specific deficiency already exists
                    const exists = existingDeficiencies.some(
                        existing => existing.description === def.description && existing.location === def.location
                    );
                    
                    // Only create if it doesn't exist yet
                    if (!exists && def.description) {
                        const severityMap = {
                            'minor': 'low',
                            'moderate': 'medium', 
                            'major': 'high',
                            'critical': 'critical',
                            'low': 'low',
                            'medium': 'medium',
                            'high': 'high'
                        };
                        
                        // Create a meaningful title from the description
                        const title = def.description.trim() 
                            ? def.description.substring(0, 80).trim()
                            : "Deficiency";
                        
                        await base44.entities.Deficiency.create({
                            inspection_id: inspectionId,
                            property_id: currentInspection.property_id,
                            client_id: currentInspection.client_id,
                            title: title,
                            description: def.description,
                            severity: severityMap[def.severity] || 'medium',
                            location: def.location || "",
                            corrective_action: def.corrective_action || "",
                            due_date: def.due_date || null,
                            status: "open"
                        });
                    }
                }
                toast.success(`Created ${deficiencies.length} deficiency record(s)`);
            } catch (error) {
                console.error("Error creating deficiency entities:", error);
                toast.error("Failed to create deficiency records");
            }
        }
        
        // If marking as completed and is recurring, create next inspection
        if (status === "completed" && currentInspection.is_recurring && currentInspection.status !== "completed") {
            try {
                const nextDate = calculateNextInspectionDate(
                    currentInspection.scheduled_date,
                    currentInspection.inspection_type
                );
                
                // Create next inspection (priority does NOT carry over)
                await base44.entities.Inspection.create({
                    client_id: currentInspection.client_id,
                    property_id: currentInspection.property_id,
                    inspector_name: currentInspection.inspector_name,
                    scheduled_date: nextDate,
                    scheduled_time: currentInspection.scheduled_time,
                    inspection_type: currentInspection.inspection_type,
                    report_types: currentInspection.report_types,
                    status: "scheduled",
                    is_recurring: true,
                    is_priority: false,
                    notes: "Auto-scheduled recurring inspection"
                });
                
                toast.success("Next inspection automatically scheduled for " + format(new Date(nextDate), "MMM d, yyyy"));
            } catch (error) {
                toast.error("Failed to schedule next inspection");
            }
        }
        
        updateMutation.mutate(updateData);
    };
    
    const calculateNextInspectionDate = (currentDate, type) => {
        const date = new Date(currentDate);
        
        switch(type) {
            case 'monthly':
                // Always schedule on 1st of next month
                date.setMonth(date.getMonth() + 1);
                date.setDate(1);
                break;
            case 'quarterly':
                date.setMonth(date.getMonth() + 3);
                date.setDate(1);
                break;
            case 'semi_annual':
                date.setMonth(date.getMonth() + 6);
                date.setDate(1);
                break;
            case 'annual':
                date.setFullYear(date.getFullYear() + 1);
                date.setDate(1);
                break;
            default:
                date.setFullYear(date.getFullYear() + 1);
                date.setDate(1);
        }
        
        return format(date, "yyyy-MM-dd");
    };



    const addDeficiency = () => {
        const today = new Date();
        const dueDate = new Date(today.setDate(today.getDate() + 14));
        const formattedDueDate = format(dueDate, "yyyy-MM-dd");
        
        setDeficiencies([...deficiencies, {
            description: "",
            severity: "medium",
            location: "",
            corrective_action: "",
            due_date: formattedDueDate
        }]);
    };

    const updateDeficiency = (index, field, value) => {
        const updated = [...deficiencies];
        updated[index] = { ...updated[index], [field]: value };
        setDeficiencies(updated);
    };

    const removeDeficiency = (index) => {
        setDeficiencies(deficiencies.filter((_, i) => i !== index));
    };

    const handleReassignCustomer = async () => {
        try {
            if (!newClientId || newClientId === currentInspection.client_id) {
                toast.error("Please select a different customer");
                return;
            }

            const { data: result } = await base44.functions.invoke('adminReassignInspectionClient', {
                inspectionId,
                newClientId
            });

            console.log("Reassign result:", result);

            // Re-fetch inspection
            await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });

            toast.success(result.message || "Customer reassigned successfully");
            setShowReassignDialog(false);
            setNewClientId("");
        } catch (error) {
            console.error("Reassign error:", error);
            toast.error(error.message || "Failed to reassign customer");
        }
    };

    const handlePdfUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== 'application/pdf') {
            toast.error("Please select a PDF file");
            return;
        }

        setUploadingPdf(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            const updatedNotes = notes + (notes ? "\n\n" : "") + `Attached PDF: ${file_url}`;
            await base44.entities.Inspection.update(inspectionId, { notes: updatedNotes });
            setNotes(updatedNotes);
            queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            toast.success("PDF uploaded successfully");
        } catch (error) {
            toast.error("Failed to upload PDF");
        } finally {
            setUploadingPdf(false);
        }
    };

    if (loadingInspection) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-64 rounded-2xl" />
                    <Skeleton className="h-96 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!currentInspection) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Inspection Not Found</h2>
                    <Link to={createPageUrl("Inspections")}>
                        <Button variant="outline">Back to Inspections</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
         <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
             <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-8 overflow-x-hidden">
                {/* Header */}
                 <div className="mb-4 sm:mb-6 space-y-3">
                     <div className="flex items-center gap-2">
                         <Link to={createPageUrl("Inspections")}>
                             <Button variant="ghost" size="icon" className="h-9 w-9">
                                 <ArrowLeft className="h-5 w-5" />
                             </Button>
                         </Link>
                         <div className="flex-1 min-w-0">
                             <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                                 {property?.name || "Inspection Details"}
                             </h1>
                             <p className="text-xs sm:text-sm text-slate-500 truncate">{client?.company_name}</p>
                         </div>
                     </div>
                     <div className="flex flex-col gap-2 w-full">
                        {userProfile?.role === "admin" && (status === "scheduled" || status === "completed") && (
                            <Button
                                variant="outline"
                                onClick={() => setShowReassignDialog(true)}
                                className="gap-2 h-10 text-sm w-full"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Reassign Customer
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 relative overflow-hidden h-10 w-full"
                        >
                            {isSaving && (
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 animate-pulse" />
                            )}
                            <span className="relative z-10 flex items-center">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                {isSaving ? "Saving..." : "Save Inspection"}
                            </span>
                        </Button>
                    </div>
                </div>

                {/* Property Info Card */}
                <Card className="mb-4 sm:mb-6">
                    <CardContent className="p-4 sm:p-6">
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-600" />
                                    Scheduled Date
                                </p>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    className="h-12 max-w-full"
                                />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-600" />
                                    Time
                                </p>
                                <Input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="h-12 max-w-full"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <User className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Inspector</p>
                                    <p className="font-medium text-slate-900">
                                        {currentInspection.inspector_name || "Not assigned"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <MapPin className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Address</p>
                                    <p className="font-medium text-slate-900">{property?.address || client?.address || "N/A"}</p>
                                </div>
                            </div>
                            {client?.phone && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <User className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Contact Phone</p>
                                        <a href={`tel:${client.phone}`} className="font-medium text-blue-600 hover:text-blue-700">
                                            {client.phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4 mt-4 pt-4 border-t">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Frequency</p>
                                <p className="font-medium text-slate-900 capitalize">
                                    {currentInspection.inspection_type?.replace('_', ' ') || "Annual"}
                                </p>
                            </div>
                        </div>
                        
                        {/* Work Order Summary */}
                         {(() => {
                             let workOrderData = null;
                             try {
                                 const rawNotes = currentInspection?.notes;
                                 if (rawNotes && typeof rawNotes === 'string') {
                                     workOrderData = JSON.parse(rawNotes);
                                 }
                             } catch (e) {
                                 // Notes not in JSON format
                             }

                             if (!workOrderData?.jobsite_hours && !workOrderData?.parts && !workOrderData?.service_provided && !workOrderData?.description_of_work && !workOrderData?.service_performed) {
                                 return null;
                             }

                             return (
                                 <div className="mt-6 pt-6 border-t border-slate-100">
                                     <p className="text-sm text-slate-500 mb-3">Work Order Summary</p>
                                     <div className="space-y-4">
                                         {(workOrderData?.description_of_work || workOrderData?.service_performed) && (
                                             <div className="pl-4 space-y-1 border-l-2 border-slate-200">
                                                 <p className="text-xs font-semibold text-slate-600">Work Performed:</p>
                                                 <p className="text-sm text-slate-900">{workOrderData.description_of_work || workOrderData.service_performed}</p>
                                             </div>
                                         )}
                                         {workOrderData?.jobsite_hours && (
                                             <div className="flex items-center gap-3">
                                                 <div className="p-3 rounded-lg bg-blue-100">
                                                     <Clock className="h-6 w-6 text-blue-600" />
                                                 </div>
                                                 <div>
                                                     <p className="text-3xl font-bold text-slate-900">
                                                         {workOrderData.jobsite_hours} hrs
                                                     </p>
                                                     <p className="text-xs text-slate-500">jobsite hours</p>
                                                 </div>
                                             </div>
                                         )}
                                         {(workOrderParts.length > 0 || (workOrderData?.parts && workOrderData.parts.length > 0)) && (
                                             <div className="pl-4 space-y-2 border-l-2 border-blue-200">
                                                 <p className="text-xs font-semibold text-slate-600 mb-2">Parts/Equipment Used:</p>
                                                 {(workOrderParts.length > 0 ? workOrderParts : workOrderData.parts).map((part, idx) => (
                                                     <div key={idx} className="text-sm text-slate-900">
                                                         <span>{part.part_name === 'custom' ? part.custom_part_name : (part.part_name || part.custom_part_name)}</span>
                                                         {part.quantity > 1 && <span className="text-slate-500"> x{part.quantity}</span>}
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                         {workOrderData?.service_provided && workOrderData.service_provided.length > 0 && (
                                             <div className="pl-4 space-y-2 border-l-2 border-green-200">
                                                 <p className="text-xs font-semibold text-slate-600 mb-2">Services Provided:</p>
                                                 {workOrderData.service_provided.map((service, idx) => (
                                                     <div key={idx} className="text-sm text-slate-900">
                                                         <span>{service.service_type === 'custom' ? service.custom_service : (service.service_type || service.custom_service)}</span>
                                                         {service.quantity > 1 && <span className="text-slate-500"> x{service.quantity}</span>}
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                     </div>
                                 </div>
                             );
                         })()}

                        {/* Fire Extinguishers Summary */}
                         {currentInspection.report_types?.includes('fire_extinguisher') && extinguishers.length > 0 && (() => {
                            // All size/type breakdown
                            const sizeTypeSummary = extinguishers.reduce((acc, ext) => {
                                const sizeType = ext.size_type || 'Unknown Size';
                                acc[sizeType] = (acc[sizeType] || 0) + 1;
                                return acc;
                            }, {});

                            // Service breakdown with size/type
                            const serviceSummary = extinguishers.reduce((acc, ext) => {
                                const service = ext.service_completed || 'No Service';
                                const sizeType = ext.size_type || 'Unknown Size';

                                if (!acc[service]) {
                                    acc[service] = { count: 0, types: {} };
                                }
                                acc[service].count++;
                                acc[service].types[sizeType] = 
                                    (acc[service].types[sizeType] || 0) + 1;

                                return acc;
                            }, {});
                            
                            return (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-sm text-slate-500 mb-3">Fire Extinguishers</p>
                                    <div className="space-y-4">
                                        {/* Total Count with Size/Type Breakdown */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-3 rounded-lg bg-orange-100">
                                                <Flame className="h-6 w-6 text-orange-600" />
                                            </div>
                                            <div>
                                                <p className="text-3xl font-bold text-slate-900">{extinguishers.length}</p>
                                                <p className="text-xs text-slate-500">total extinguishers</p>
                                            </div>
                                        </div>
                                        
                                        {/* Service Breakdown */}
                                        {Object.keys(serviceSummary).length > 0 && (
                                            <div className="pl-4 space-y-2 border-l-2 border-orange-200">
                                                <p className="text-xs font-semibold text-slate-600 mb-2">Services Performed:</p>
                                                {Object.entries(serviceSummary)
                                                    .filter(([service]) => service !== 'No Service')
                                                    .map(([service, data]) => (
                                                    <div key={service}>
                                                        <p className="text-sm font-semibold text-slate-900">{service}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {data.count} unit{data.count > 1 ? 's' : ''}
                                                            {Object.keys(data.types).length > 0 && ` - ${
                                                                Object.entries(data.types)
                                                                    .map(([type, count]) => `${count}x ${type}`)
                                                                    .join(', ')
                                                            }`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        
                        {/* Fire Alarm Hours & Batteries Summary */}
                        {currentInspection.report_types?.includes('fire_alarm') && fireAlarmReports.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <p className="text-sm text-slate-500 mb-3">Fire Alarm</p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-lg bg-red-100">
                                            <Clock className="h-6 w-6 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-3xl font-bold text-slate-900">
                                                {fireAlarmReports[0]?.jobsite_hours || "0"} hrs
                                            </p>
                                            <p className="text-xs text-slate-500">total jobsite hours</p>
                                        </div>
                                    </div>
                                    {fireAlarmReports[0]?.batteries_replaced_details && fireAlarmReports[0].batteries_replaced_details.length > 0 && (
                                        <div className="pl-4 space-y-1 border-l-2 border-red-200">
                                            <p className="text-xs font-semibold text-slate-600">Batteries Replaced:</p>
                                            {fireAlarmReports[0].batteries_replaced_details.map((battery, idx) => (
                                                <p key={idx} className="text-sm text-slate-900">
                                                    {battery.qty}x {battery.size}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Kitchen Suppression Summary */}
                        {currentInspection.report_types?.includes('kitchen_suppression') && (() => {
                            const fusibleLinksData = wetChemicalReports
                                .filter(r => r.fusible_links_used)
                                .map(r => r.fusible_links_used)
                                .filter(Boolean);
                            const rubberCapsTotal = wetChemicalReports
                                .filter(r => r.blow_off_caps_used)
                                .reduce((sum, r) => sum + (parseInt(r.blow_off_caps_used) || 0), 0);

                            return (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-sm text-slate-500 mb-3">Kitchen Suppression Materials Used</p>
                                    <div className="flex gap-4 flex-wrap">
                                        {fusibleLinksData.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-blue-100">
                                                    <ChefHat className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Fusible Links</p>
                                                    <p className="text-sm font-semibold text-slate-900">{fusibleLinksData.join(', ')}</p>
                                                </div>
                                            </div>
                                        )}
                                        {rubberCapsTotal > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-purple-100">
                                                    <ChefHat className="h-4 w-4 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Rubber Caps</p>
                                                    <p className="text-lg font-bold text-slate-900">{rubberCapsTotal}</p>
                                                </div>
                                            </div>
                                        )}
                                        {fusibleLinksData.length === 0 && rubberCapsTotal === 0 && (
                                            <p className="text-sm text-slate-400">No materials recorded yet</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Emergency Light Summary */}
                        {currentInspection.report_types?.includes('emergency_lighting') && emergencyLightReports.length > 0 && (() => {
                            const mostRecentReport = emergencyLightReports.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0];
                            const totalLights = (mostRecentReport?.light_locations || []).filter(light => light.location).length;
                            const newUnits = mostRecentReport?.replaced_unit_type ? [mostRecentReport] : [];
                            const allBatteries = (mostRecentReport?.batteries || [])
                                .filter(b => b && b.quantity && b.type);
                            
                            // Only show section if there's actual data
                            if (totalLights === 0 && newUnits.length === 0 && allBatteries.length === 0) {
                                return null;
                            }

                            return (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-sm text-slate-500 mb-3">Emergency Lighting Materials</p>
                                    <div className="flex gap-4 flex-wrap">
                                        {totalLights > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-blue-100">
                                                    <Lightbulb className="h-4 w-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Lights Inspected</p>
                                                    <p className="text-sm font-semibold text-slate-900">{totalLights}</p>
                                                </div>
                                            </div>
                                        )}
                                        {newUnits.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-yellow-100">
                                                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Units Replaced</p>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {newUnits.map(r => `${r.replaced_unit_type}${r.replaced_unit_quantity ? ` (${r.replaced_unit_quantity})` : ''}`).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {allBatteries.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-green-100">
                                                    <Lightbulb className="h-4 w-4 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Batteries Provided</p>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {allBatteries.map(b => `${b.quantity}x ${b.type}`).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        
                        {/* Report Types */}
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="space-y-3 mb-3">
                                <p className="text-sm text-slate-500">Report Types</p>
                                <div className="flex gap-2 w-full">
                                    <Select value={newReportTypeToAdd} onValueChange={setNewReportTypeToAdd}>
                                        <SelectTrigger className="flex-1 h-10">
                                            <SelectValue placeholder="Add Report Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(reportTypeConfig)
                                                .filter(([key]) => !currentInspection?.report_types?.includes(key))
                                                .map(([key, config]) => (
                                                    <SelectItem key={key} value={key}>
                                                        {config.label}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        onClick={() => {
                                            setIsAddingReportType(true);
                                            addReportTypeMutation.mutate(newReportTypeToAdd);
                                        }}
                                        disabled={!newReportTypeToAdd || isAddingReportType}
                                        className="h-10 w-10 p-0 shrink-0"
                                    >
                                        {isAddingReportType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            {currentInspection.report_types?.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {currentInspection.report_types.map(type => {
                                        const config = reportTypeConfig[type];
                                        const Icon = reportTypeIcons[type];
                                        if (!config || !Icon) return null;
                                        return (
                                            <div key={type} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                                                <div className={`p-2 rounded-lg ${config.color}`}>
                                                    <Icon className="h-4 w-4 text-white" />
                                                </div>
                                                <span className="text-sm font-medium text-slate-900">{config.label}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeReportTypeMutation.mutate(type)}
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex flex-col gap-2 mt-4">
                                    {currentInspection.report_types.includes('fire_extinguisher') && (
                                        <Link to={createPageUrl("FireExtinguisherSurvey") + `?id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <FileText className="h-4 w-4" />
                                                Fire Extinguisher Survey
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('fire_alarm') && (
                                        <Link to={createPageUrl("FireAlarmReport") + `?id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <FileText className="h-4 w-4" />
                                                Fire Alarm Report
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('kitchen_suppression') && (
                                        <Link to={createPageUrl("WetChemicalReport") + `?inspection_id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <FileText className="h-4 w-4" />
                                                Kitchen Suppression Report
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('emergency_lighting') && (
                                        <Link to={createPageUrl("EmergencyLightReport") + `?id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <Lightbulb className="h-4 w-4" />
                                                Emergency Light Report
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('sprinkler_system') && (
                                        <Link to={createPageUrl("WetSprinklerReport") + `?inspection_id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <Droplets className="h-4 w-4" />
                                                Wet Sprinkler Report
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('work_order') && (
                                        <Link to={createPageUrl("WorkOrderReport") + `?inspection_id=${inspectionId}`}>
                                            <Button variant="outline" className="gap-2">
                                                <FileText className="h-4 w-4" />
                                                Work Order
                                            </Button>
                                        </Link>
                                    )}
                                    {currentInspection.report_types.includes('pdf_upload') && (
                                        <label>
                                            <Button variant="outline" className="gap-2" disabled={uploadingPdf} asChild>
                                                <span>
                                                    {uploadingPdf ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <File className="h-4 w-4" />
                                                    )}
                                                    {uploadingPdf ? "Uploading..." : "Upload PDF"}
                                                </span>
                                            </Button>
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handlePdfUpload}
                                                className="hidden"
                                                disabled={uploadingPdf}
                                            />
                                        </label>
                                    )}
                                    {currentInspection.report_types.includes('pdf_signing') && (
                                        <div>
                                            <PDFSigningFlow 
                                                inspection={currentInspection}
                                                onComplete={(result) => {
                                                    if (result.signed_pdf_url) {
                                                        const updatedNotes = currentInspection.notes 
                                                            ? `${currentInspection.notes}\nSigned PDF: ${result.signed_pdf_url}` 
                                                            : `Signed PDF: ${result.signed_pdf_url}`;
                                                        
                                                        updateMutation.mutate({
                                                            signed_pdf: result.signed_pdf_url,
                                                            signature_image: result.signature_image || null,
                                                            signed_by_name: result.signed_by_name || null,
                                                            signed_at: new Date().toISOString(),
                                                            signature_status: "Signed",
                                                            notes: updatedNotes
                                                        });
                                                    } else {
                                                        toast.error("Failed to get signed PDF URL");
                                                    }
                                                    queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
                                                }}
                                            />
                                        </div>
                                    )}

                                    </div>
                                    </div>
                                    </CardContent>
                                    </Card>

                {/* Status */}
                <div className="mb-4 sm:mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <Label className="mb-2 block">Inspection Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="scheduled">Scheduled</SelectItem>
                                    <SelectItem value="to_be_completed">To Be Completed</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="requires_followup">Requires Follow-up</SelectItem>
                                    {userProfile?.role === "admin" && (
                                        <SelectItem value="invoiced">Invoiced</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="deficiencies" className="space-y-4">
                    <TabsList className="bg-white border">
                        <TabsTrigger value="deficiencies">
                            Deficiencies {deficiencies.length > 0 && `(${deficiencies.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="deficiencies">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Deficiencies Found</CardTitle>
                                <Button onClick={addDeficiency} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Deficiency
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {deficiencies.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                                        <p>No deficiencies recorded</p>
                                    </div>
                                ) : (
                                    deficiencies.map((def, idx) => (
                                        <div key={idx} className="p-4 border border-slate-200 rounded-xl space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="md:col-span-2">
                                                        <Label>Description</Label>
                                                        <Textarea
                                                            value={def.description}
                                                            onChange={(e) => updateDeficiency(idx, 'description', e.target.value)}
                                                            placeholder="Description of deficiency"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Severity</Label>
                                                        <Select
                                                            value={def.severity}
                                                            onValueChange={(value) => updateDeficiency(idx, 'severity', value)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="minor">Minor</SelectItem>
                                                                <SelectItem value="moderate">Moderate</SelectItem>
                                                                <SelectItem value="major">Major</SelectItem>
                                                                <SelectItem value="critical">Critical</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Due Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={def.due_date}
                                                            onChange={(e) => updateDeficiency(idx, 'due_date', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <Label>Corrective Action</Label>
                                                        <Textarea
                                                            value={def.corrective_action}
                                                            onChange={(e) => updateDeficiency(idx, 'corrective_action', e.target.value)}
                                                            placeholder="What needs to be done to fix this?"
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeDeficiency(idx)}
                                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notes">
                        <div className="space-y-4">
                            {/* Signed PDF Viewer */}
                            {currentInspection?.signed_pdf && (
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            <p className="text-sm font-medium">Signed PDF Document</p>
                                        </div>
                                        <PDFViewer pdfUrl={currentInspection.signed_pdf} />
                                    </CardContent>
                                </Card>
                            )}

                            {/* PDF Viewers with Annotator - Show all attached PDFs */}
                            {notes && notes.includes('Attached PDF:') && !currentInspection?.signed_pdf && (() => {
                                // Extract ALL PDF URLs from notes
                                const pdfUrls = [];
                                const regex = /Attached PDF:\s*(https?:\/\/[^\s\n]+)/gi;
                                let match;
                                while ((match = regex.exec(notes)) !== null) {
                                    let url = match[1].replace(/[)\]}>.,;]+$/, '').trim();
                                    if (url.includes('supabase.co') && url.startsWith('http:')) {
                                        url = url.replace('http:', 'https:');
                                    }
                                    pdfUrls.push(url);
                                }

                                const handleDeletePdf = async (urlToDelete) => {
                                    if (!confirm('Are you sure you want to delete this PDF?')) return;
                                    
                                    try {
                                        // Remove the specific PDF URL from notes
                                        const updatedNotes = notes.replace(
                                            new RegExp(`Attached PDF:\\s*${urlToDelete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\n*`, 'gi'),
                                            ''
                                        ).trim();
                                        
                                        await base44.entities.Inspection.update(inspectionId, { notes: updatedNotes });
                                        setNotes(updatedNotes);
                                        queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
                                        toast.success('PDF deleted successfully');
                                    } catch (error) {
                                        toast.error('Failed to delete PDF');
                                    }
                                };

                                return pdfUrls.map((pdfUrl, index) => (
                                    <Card key={pdfUrl}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-5 w-5 text-blue-600" />
                                                    <p className="text-sm font-medium">
                                                        Attached PDF {pdfUrls.length > 1 ? `#${index + 1}` : ''} - Draw to Add Signature
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <a href={pdfUrl} download>
                                                        <Button variant="outline" size="sm" className="gap-2">
                                                            <Download className="h-4 w-4" />
                                                            Download
                                                        </Button>
                                                    </a>
                                                    {userProfile?.role === "admin" && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                                            onClick={() => handleDeletePdf(pdfUrl)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <PDFAnnotator 
                                                key={pdfUrl}
                                                pdfUrl={pdfUrl} 
                                                initialSignatureImage={currentInspection?.signature_image}
                                                onSave={async (annotatedFile, metadata) => {
                                                    try {
                                                        const { file_url } = await base44.integrations.Core.UploadFile({ 
                                                            file: annotatedFile 
                                                        });

                                                        const { data: signedPdfResult } = await base44.functions.invoke('generateSignedPDF', {
                                                            pdfUrl,
                                                            signatureImageUrl: file_url,
                                                            signatureMetadata: metadata
                                                        });

                                                        const currentUser = await base44.auth.me();

                                                        await base44.entities.Inspection.update(inspectionId, { 
                                                            signature_image: file_url,
                                                            signed_pdf: signedPdfResult.signed_pdf_url,
                                                            signature_status: "Signed",
                                                            signed_at: new Date().toISOString(),
                                                            signed_by_name: currentUser?.full_name || "Inspector"
                                                        });
                                                        await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
                                                        await queryClient.refetchQueries({ queryKey: ['inspection', inspectionId] });

                                                        toast.success("Signed PDF generated successfully!");
                                                        return { file_url };
                                                    } catch (error) {
                                                        console.error("Upload error:", error);
                                                        throw error;
                                                    }
                                                }}
                                            />
                                        </CardContent>
                                    </Card>
                                ));
                            })()}
                            
                            {/* Notes */}
                            <Card>
                                <CardContent className="p-6">
                                    <Label className="mb-2 block">Additional Notes</Label>
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add any additional notes about this inspection..."
                                        rows={8}
                                        className="resize-none"
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Reassign Customer Dialog */}
                <AlertDialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reassign Customer</AlertDialogTitle>
                            <AlertDialogDescription>
                                Change the customer for this inspection. All reports and data will remain intact.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4 space-y-4">
                            <div>
                                <Label className="text-sm font-medium mb-2 block">Current Customer</Label>
                                <div className="p-3 bg-slate-100 rounded-lg">
                                    <p className="font-medium text-slate-900">{client?.company_name}</p>
                                    <p className="text-sm text-slate-500">{client?.contact_name}</p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium mb-2 block">New Customer</Label>
                                <Select value={newClientId} onValueChange={setNewClientId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select new customer..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients
                                            .filter(c => c.id !== currentInspection?.client_id)
                                            .map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.company_name} - {c.contact_name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {currentInspection?.reassigned_at && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs font-medium text-amber-900 mb-1">Previous Reassignment</p>
                                    <p className="text-xs text-amber-700">
                                        Last reassigned on {format(new Date(currentInspection.reassigned_at), "MMM d, yyyy 'at' h:mm a")}
                                    </p>
                                </div>
                            )}
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setNewClientId("")}>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleReassignCustomer}
                                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                Reassign Customer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}