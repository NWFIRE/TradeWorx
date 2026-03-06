import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAutoSave } from "@/components/reports/useAutoSave";
import AutoSaveIndicator from "@/components/reports/AutoSaveIndicator";
import { useOfflineData } from "@/components/offline/useOfflineData";
import { offlineStorage } from "@/components/offline/offlineStorage";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Save,
    Loader2,
    Lightbulb,
    Printer,
    Check,
    Copy
} from "lucide-react";
import SignaturePad from "../components/inspections/SignaturePad";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function EmergencyLightReport() {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [lights, setLights] = useState([]);
    const [customerSignature, setCustomerSignature] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [address, setAddress] = useState("");
    const [overallStatus, setOverallStatus] = useState("Pass");
    const [replacedUnitType, setReplacedUnitType] = useState("");
    const [replacedUnitQuantity, setReplacedUnitQuantity] = useState("");
    const [batteries, setBatteries] = useState([]);
    const [notes, setNotes] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [showExitDialog, setShowExitDialog] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { isOnline, queueSync } = useOfflineData();

    const saveReportMutation = useMutation({
        mutationFn: async () => {
            const lightLocations = lights.map(light => ({
                location: light.location || "",
                type: light.type || "",
                pass_fail: light.pass_fail || "Pass",
                notes: light.notes || ""
            }));

            const allBatteries = lights
                .filter(light => light.batteryQuantity && light.batteryType)
                .map(light => ({
                    quantity: parseInt(light.batteryQuantity),
                    type: light.batteryType
                }));

            const replacedUnits = lights.filter(light => light.isNew);
            const replacedUnitTypes = [...new Set(replacedUnits.map(l => l.type))];

            const reportData = {
                inspection_id: inspectionId,
                property_id: currentInspection?.property_id,
                client_id: currentInspection?.client_id,
                service_date: currentInspection?.scheduled_date || format(new Date(), 'yyyy-MM-dd'),
                customer_name: customerName,
                address: address,
                light_locations: lightLocations,
                replaced_unit_type: replacedUnitTypes.length > 0 ? replacedUnitTypes.join(", ") : null,
                replaced_unit_quantity: replacedUnits.length > 0 ? replacedUnits.length : null,
                batteries: allBatteries,
                overall_status: overallStatus,
                technician_name: currentInspection?.inspector_name || "",
                customer_signature_url: customerSignature,
                notes: notes
            };

            if (isOnline) {
                // Online - save directly
                if (existingLights.length > 0 && existingLights[0]?.id) {
                    await base44.entities.EmergencyLightReport.update(existingLights[0].id, reportData);
                } else {
                    await base44.entities.EmergencyLightReport.create(reportData);
                }
                
                // Auto-create deficiencies for failed lights
                const failedLights = lights.filter(l => l.pass_fail === "Fail");
                if (failedLights.length > 0) {
                    const existingDeficiencies = await base44.entities.Deficiency.filter({ 
                        inspection_id: inspectionId,
                        category: "emergency_lighting"
                    });
                    
                    if (existingDeficiencies.length === 0) {
                        const deficiencyDesc = failedLights.map(l => 
                            `${l.type || 'Light'} at ${l.location}: ${l.notes || 'Failed inspection'}`
                        ).join("\n");
                        
                        await base44.entities.Deficiency.create({
                            inspection_id: inspectionId,
                            property_id: currentInspection?.property_id,
                            client_id: currentInspection?.client_id,
                            title: "Emergency Lighting Failures",
                            description: deficiencyDesc,
                            severity: overallStatus === "Fail" ? "high" : "medium",
                            category: "emergency_lighting",
                            status: "open"
                        });
                    }
                }

                await queryClient.invalidateQueries({ queryKey: ['emergencyLights', inspectionId] });
                await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
                await queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
            } else {
                // Offline - cache and queue for sync
                const cacheData = {
                    lights,
                    customerSignature,
                    customerName,
                    address,
                    overallStatus,
                    replacedUnitType,
                    replacedUnitQuantity,
                    batteries,
                    notes
                };
                
                await offlineStorage.cacheData(`emergency_light_report_${inspectionId}`, cacheData);
                
                if (existingLights.length > 0 && existingLights[0]?.id) {
                    await queueSync('update_emergency_light_report', { id: existingLights[0].id, updates: reportData });
                } else {
                    await queueSync('create_emergency_light_report', reportData);
                }
            }
        },
    });

    const reportData = { lights, customerSignature, customerName, address, overallStatus, replacedUnitType, replacedUnitQuantity, batteries, notes };
    
    const { isSaving: isAutoSaving, lastSaved } = useAutoSave(reportData, async () => {
        if (!isDirty) return;
        await saveReportMutation.mutateAsync();
    }, { enabled: isDirty });

    const { data: inspection, isLoading: loadingInspection } = useQuery({
        queryKey: ['inspection', inspectionId],
        queryFn: () => base44.entities.Inspection.filter({ id: inspectionId }),
        enabled: !!inspectionId,
    });

    const { data: existingLights = [], isLoading: loadingLights } = useQuery({
        queryKey: ['emergencyLights', inspectionId],
        queryFn: () => base44.entities.EmergencyLightReport.filter({ inspection_id: inspectionId }),
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

    const currentInspection = inspection?.[0];
    const property = properties.find(p => p.id === currentInspection?.property_id);
    const client = clients.find(c => c.id === currentInspection?.client_id);

    useEffect(() => {
        const loadLightData = async () => {
            // Try to load from cache first if offline
            if (!isOnline) {
                const cachedData = await offlineStorage.getCachedData(`emergency_light_report_${inspectionId}`);
                if (cachedData) {
                    setLights(cachedData.lights || []);
                    setCustomerSignature(cachedData.customerSignature || "");
                    setCustomerName(cachedData.customerName || "");
                    setAddress(cachedData.address || "");
                    setOverallStatus(cachedData.overallStatus || "Pass");
                    setReplacedUnitType(cachedData.replacedUnitType || "");
                    setReplacedUnitQuantity(cachedData.replacedUnitQuantity || "");
                    setBatteries(cachedData.batteries || []);
                    setNotes(cachedData.notes || "");
                    return;
                }
            }
            
            if (existingLights.length > 0) {
                const report = existingLights[0];
            
            // Load light locations from the report, filtering out blank entries
            if (report.light_locations && Array.isArray(report.light_locations)) {
                // Build map of batteries and replaced units from report
                const batteryMap = new Map();
                if (report.batteries && Array.isArray(report.batteries)) {
                    report.batteries.forEach(b => {
                        const key = `${b.quantity}_${b.type}`;
                        batteryMap.set(key, b);
                    });
                }
                
                const replacedTypes = report.replaced_unit_type ? report.replaced_unit_type.split(", ") : [];
                
                const loadedLights = report.light_locations
                    .filter(loc => loc.location)
                    .map((loc, index) => ({
                        inspection_id: inspectionId,
                        property_id: currentInspection?.property_id,
                        client_id: currentInspection?.client_id,
                        location: loc.location || "",
                        type: loc.type || "",
                        pass_fail: loc.pass_fail || "Pass",
                        notes: loc.notes || "",
                        isNew: replacedTypes.includes(loc.type),
                        batteryQuantity: loc.batteryQuantity || "",
                        batteryType: loc.batteryType || ""
                    }));
                setLights(loadedLights);
            }
            
            // Load other report data
            if (report.overall_status) {
                setOverallStatus(report.overall_status);
            }
            if (report.notes) {
                setNotes(report.notes);
            }
            if (report.replaced_unit_type) {
                setReplacedUnitType(report.replaced_unit_type);
                setReplacedUnitQuantity(report.replaced_unit_quantity || "");
            }
            if (report.batteries && Array.isArray(report.batteries)) {
                setBatteries(report.batteries);
            }
            if (report.customer_name) {
                setCustomerName(report.customer_name);
            }
            if (report.customer_signature_url) {
                setCustomerSignature(report.customer_signature_url);
            }
            if (report.address) {
                setAddress(report.address);
            }
            }
        };
        
        loadLightData();
    }, [existingLights, isOnline, inspectionId]);

    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (property?.address) {
            setAddress(property.address);
        } else if (client?.address) {
            setAddress(client.address);
        }
    }, [property, client]);

    useEffect(() => {
        if (currentInspection?.notes) {
            const signatureMatch = currentInspection.notes.match(/Emergency Light Report - Customer Signature:\s*(https?:\/\/\S+)/);
            if (signatureMatch) {
                setCustomerSignature(signatureMatch[1]);
            }
            const nameMatch = currentInspection.notes.match(/Emergency Light Report - Customer Name:\s*(.+?)(?:\n|$)/);
            if (nameMatch) {
                setCustomerName(nameMatch[1].trim());
            }
        }
    }, [currentInspection]);

    const addLight = () => {
        const newLight = {
            inspection_id: inspectionId,
            property_id: currentInspection?.property_id,
            client_id: currentInspection?.client_id,
            location: "",
            type: "",
            pass_fail: "Pass",
            notes: "",
            isNew: false,
            batteryQuantity: "",
            batteryType: ""
        };
        setLights([...lights, newLight]);
        setIsDirty(true);
    };

    const updateLight = (index, field, value) => {
        const updated = [...lights];
        updated[index] = { ...updated[index], [field]: value };
        setLights(updated);
        setIsDirty(true);
    };

    const removeLight = (index) => {
        setLights(lights.filter((_, i) => i !== index));
        setIsDirty(true);
        toast.success("Light entry removed");
    };

    const duplicateLight = (index) => {
        const lightToCopy = lights[index];
        const duplicated = {
            ...lightToCopy,
            id: undefined, // Remove ID so it's treated as new
            location: lightToCopy.location + " (Copy)"
        };
        setLights([...lights, duplicated]);
        setIsDirty(true);
        toast.success("Light duplicated");
    };

    const addBattery = () => {
        setBatteries([...batteries, { quantity: "", type: "6v4.5ah" }]);
        setIsDirty(true);
    };

    const updateBattery = (index, field, value) => {
        const updated = [...batteries];
        updated[index] = { ...updated[index], [field]: value };
        setBatteries(updated);
        setIsDirty(true);
    };

    const removeBattery = (index) => {
        setBatteries(batteries.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveReportMutation.mutateAsync();
            toast.success(isOnline ? "Report saved successfully" : "Report saved offline - will sync when connected");
            setIsDirty(false);
        } catch (error) {
            console.error("Save error:", error);
            toast.error(isOnline ? "Failed to save report" : "Failed to save offline");
        }
        setIsSaving(false);
    };

    const handleBackClick = (e) => {
        if (isDirty) {
            e.preventDefault();
            setShowExitDialog(true);
        }
    };

    const handlePreview = async () => {
        setLoadingPreview(true);
        try {
            const { data } = await base44.functions.invoke('generateemergencylightreport', {
                inspection_id: inspectionId
            });
            setPreviewHtml(data.html);
            setShowPreview(true);
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to generate preview');
        }
        setLoadingPreview(false);
    };

    const handlePrint = async () => {
        setLoadingPreview(true);
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><body><h2>Loading report...</h2></body></html>');
        
        try {
            const { data } = await base44.functions.invoke('generateemergencylightreport', {
                inspection_id: inspectionId
            });
            printWindow.document.open();
            printWindow.document.write(data.html);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        } catch (error) {
            console.error('Print error:', error);
            toast.error('Failed to generate report');
            printWindow.close();
        }
        setLoadingPreview(false);
    };

    if (loadingInspection || loadingLights) {
        return (
            <div className="min-h-screen bg-white p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-96 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!currentInspection) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
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
        <div className="min-h-screen bg-white print:bg-white">
            <style>{`
                @media print {
                    @page { margin: 0.25in; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { margin: 0; padding: 0; line-height: 1.1; font-size: 7pt; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .print\\:hidden { display: none !important; }
                    .max-w-7xl { max-width: 100%; margin: 0; padding: 0; }
                    .px-4, .px-6, .px-8, .py-8 { padding: 0 !important; }
                    .mb-6, .mb-4, .mb-3, .mb-2, .mb-1 { margin-bottom: 0.03in !important; }
                    .space-y-4 > * + *, .space-y-3 > * + * { margin-top: 0 !important; }
                    .h-20, .h-16, .h-10 { height: 0.6in !important; }
                    .rounded-2xl, .rounded-xl, .rounded-lg { border-radius: 0 !important; }
                    .shadow-lg, .shadow-sm, .shadow { box-shadow: none !important; border: none !important; }
                    .border { border: none !important; }
                    .text-xl, .text-lg { font-size: 9pt !important; font-weight: bold; }
                    .text-base { font-size: 7pt !important; }
                    .text-sm { font-size: 6.5pt !important; }
                    .text-xs { font-size: 6pt !important; }
                    .bg-gradient-to-r, .bg-blue-500 { background: none !important; }
                    .p-8, .p-4, .p-2 { padding: 0 !important; }
                    .gap-3, .gap-2 { gap: 0 !important; }
                    
                    .print-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        font-size: 6.5pt; 
                        margin: 0.03in 0;
                    }
                    .print-table td, .print-table th { 
                        padding: 0.02in 0.04in; 
                        border: 0.5px solid #666; 
                        vertical-align: middle;
                        font-size: 6.5pt;
                    }
                    .print-table th { 
                        font-weight: bold; 
                        background: #e8e8e8;
                        text-align: center;
                    }
                    
                    .print-logo { height: 0.6in !important; }
                    
                    .space-y-4 > div { display: none !important; }
                    .flex-1, .flex { display: none !important; }
                    
                    /* Footer */
                    .print-footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 0.6in;
                        display: flex;
                        align-items: center;
                        padding: 0 0.4in;
                        border-top: 1px solid #ccc;
                        background: white;
                        font-size: 7pt;
                    }
                    .print-footer-logo {
                        height: 0.32in;
                        width: auto;
                        margin-right: 0.15in;
                    }
                    .print-footer-text {
                        flex: 1;
                        text-align: center;
                        font-size: 7pt;
                        line-height: 1.3;
                    }
                }
            `}</style>
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 print:p-0 overflow-x-hidden">
                {/* Logo and Company Info - Print Only */}
                <div className="hidden print:block text-center mb-2">
                    <img
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png"
                        alt="NW Fire & Safety"
                        className="print-logo"
                        style={{ height: '90px', width: 'auto', margin: '0 auto 0.1in auto', display: 'block' }}
                    />
                    <div style={{ fontSize: '7pt', lineHeight: '1.2', marginBottom: '0.05in' }}>
                        <div style={{ fontWeight: 'bold' }}>Northwest Fire & Safety, LLC</div>
                        <div>580-540-3119 | 2517 N Van Buren - Enid, OK 73703</div>
                        <div>OK #AC441117, #466</div>
                    </div>
                    <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '0.1in' }}>EMERGENCY LIGHTING INSPECTION REPORT</h2>
                </div>

                {/* Header */}
                <div className="mb-3 print:mb-2">
                    <div className="flex justify-center mb-2 print:hidden">
                        <img 
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/ab5e51f05_LOGO-2024-BlackSurround.jpg" 
                            alt="NW Fire & Safety" 
                            className="h-16 w-auto"
                        />
                    </div>
                    
                    {/* Company Info */}
                    <div className="text-center mb-4 print:hidden text-xs leading-tight">
                        <div>Northwest Fire & Safety, LLC</div>
                        <div>580-540-3119</div>
                        <div>2517 N Van Buren - Enid, OK 73703</div>
                        <div>www.nwfireandsafety.com</div>
                        <div>OK # AC441117, 466</div>
                    </div>
                    
                    <div className="no-print mb-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Link to={createPageUrl("InspectionDetails") + `?id=${inspectionId}`} onClick={handleBackClick}>
                                <Button variant="ghost" size="icon" className="h-9 w-9">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="p-2 rounded-xl bg-blue-500">
                                <Lightbulb className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Emergency Light Report</h1>
                                <p className="text-slate-500 text-xs truncate">NFPA 101 Requirements</p>
                            </div>
                            <AutoSaveIndicator isSaving={isAutoSaving} lastSaved={lastSaved} />
                        </div>
                        <div className="flex gap-2 w-full">
                            <Button 
                                variant="outline" 
                                className="gap-2 flex-1"
                                onClick={handlePreview}
                                disabled={loadingPreview}
                            >
                                {loadingPreview ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Printer className="h-4 w-4" />
                                )}
                                Preview
                            </Button>
                            <Button 
                                variant="outline" 
                                className="gap-2 flex-1"
                                onClick={handlePrint}
                                disabled={loadingPreview}
                            >
                                {loadingPreview ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Printer className="h-4 w-4" />
                                )}
                                Print
                            </Button>
                        </div>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="no-print w-full bg-gradient-to-r from-blue-500 to-blue-600 relative overflow-hidden"
                    >
                        {isSaving && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 animate-pulse" />
                        )}
                        <span className="relative z-10 flex items-center">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Report
                                </>
                            )}
                        </span>
                    </Button>
                </div>

                {/* Print-Only Condensed Table View */}
                <div className="hidden print:block">
                    <table className="print-table" style={{marginBottom: "0.04in"}}>
                        <tr>
                            <td style={{width: "20%"}}><strong>Client:</strong></td>
                            <td style={{width: "30%"}}>{client?.company_name || "N/A"}</td>
                            <td style={{width: "20%"}}><strong>Date:</strong></td>
                            <td style={{width: "30%"}}>
                                {currentInspection.scheduled_date 
                                    ? format(new Date(currentInspection.scheduled_date), "MM/dd/yyyy")
                                    : "N/A"}
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Property Address:</strong></td>
                            <td colSpan="3">{address || "N/A"}</td>
                        </tr>
                        <tr>
                            <td><strong>Technician:</strong></td>
                            <td colSpan="3">{currentInspection.inspector_name || "N/A"}</td>
                        </tr>
                    </table>

                    {lights.length > 0 && (
                        <table className="print-table">
                            <thead>
                                <tr>
                                    <th style={{width: "30%"}}>Location</th>
                                    <th style={{width: "25%"}}>Type</th>
                                    <th style={{width: "15%"}}>Status</th>
                                    <th style={{width: "30%"}}>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lights.map((light, idx) => (
                                    <tr key={light.id || idx}>
                                        <td>{light.location || "-"}</td>
                                        <td>{light.type || "-"}</td>
                                        <td style={{textAlign: "center"}}>{light.pass_fail || "-"}</td>
                                        <td>{light.notes || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    
                    <div style={{textAlign: "center", fontSize: "6pt", marginTop: "0.05in"}}>
                        Overall Status: {overallStatus} | NFPA 101 & Manufacturer Requirements
                    </div>
                    
                    {(customerName || customerSignature) && (
                        <div style={{marginTop: "0.15in", border: "0.5px solid #ccc", padding: "0.05in"}}>
                            {customerName && (
                                <div style={{marginBottom: "0.05in"}}>
                                    <div style={{fontSize: "6.5pt", fontWeight: "bold"}}>Customer Name</div>
                                    <div style={{fontSize: "7pt"}}>{customerName}</div>
                                </div>
                            )}
                            {customerSignature && (
                                <div>
                                    <div style={{fontSize: "6.5pt", fontWeight: "bold", marginBottom: "0.02in"}}>Customer Signature</div>
                                    <img src={customerSignature} alt="Customer Signature" style={{maxHeight: "0.6in", width: "100%"}} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Client & Property Info */}
                <Card className="mb-3 print:hidden">
                    <CardContent className="p-4 print:p-2 space-y-3 print:space-y-1 text-sm">
                        <div>
                            <Label className="text-xs text-slate-500">Client</Label>
                            <p className="font-semibold text-slate-900">{client?.company_name || "N/A"}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-slate-500">Address</Label>
                            <Input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Enter address"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs text-slate-500">Date</Label>
                                <p className="text-slate-900">
                                    {currentInspection.scheduled_date 
                                        ? format(new Date(currentInspection.scheduled_date), "MMM d, yyyy")
                                        : "N/A"}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Technician</Label>
                                <p className="text-slate-900">{currentInspection.inspector_name || "N/A"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Lights */}
                <h2 className="text-lg font-semibold text-slate-900 mb-4 print:hidden">Emergency Lights</h2>

                {lights.length === 0 ? (
                    <Card className="mb-4 print:hidden">
                        <CardContent className="p-8 text-center text-slate-500">
                            <Lightbulb className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p className="mb-3">No lights added yet</p>
                            <Button onClick={addLight} variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Light
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4 print:hidden">
                        {lights.map((light, idx, array) => (
                            <div key={light.id || idx} className="space-y-3">
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base">Light #{idx + 1}</CardTitle>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => duplicateLight(idx)}
                                                className="h-8 text-blue-500 hover:text-blue-700"
                                                title="Duplicate this light"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeLight(idx)}
                                                className="h-8 text-rose-500 hover:text-rose-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <Label className="text-xs">Location *</Label>
                                        <Input
                                            value={light.location || ""}
                                            onChange={(e) => { updateLight(idx, 'location', e.target.value); setIsDirty(true); }}
                                            placeholder="e.g., Main Entrance, Exit Hallway"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Type *</Label>
                                            <Select
                                                value={light.type || ""}
                                                onValueChange={(value) => { updateLight(idx, 'type', value); setIsDirty(true); }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Exit Sign">Exit Sign</SelectItem>
                                                    <SelectItem value="Emergency Light">Emergency Light</SelectItem>
                                                    <SelectItem value="Combo Light">Combo Light</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Status</Label>
                                            <Select
                                                value={light.pass_fail || "Pass"}
                                                onValueChange={(value) => { updateLight(idx, 'pass_fail', value); setIsDirty(true); }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pass">Pass</SelectItem>
                                                    <SelectItem value="Fail">Fail</SelectItem>
                                                    <SelectItem value="N/A">N/A</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs">Notes</Label>
                                        <Input
                                            value={light.notes || ""}
                                            onChange={(e) => { updateLight(idx, 'notes', e.target.value); setIsDirty(true); }}
                                            placeholder="Additional observations..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs">Battery Quantity</Label>
                                            <Select value={light.batteryQuantity?.toString() || ""} onValueChange={(v) => { updateLight(idx, 'batteryQuantity', v); setIsDirty(true); }}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Qty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={null}>-- Select --</SelectItem>
                                                    {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
                                                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Battery Type</Label>
                                            <Select value={light.batteryType || ""} onValueChange={(v) => { updateLight(idx, 'batteryType', v); setIsDirty(true); }}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="6v4.5ah">6v4.5ah</SelectItem>
                                                    <SelectItem value="6v10ah">6v10ah</SelectItem>
                                                    <SelectItem value="12v18ah">12v18ah</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={`new-${idx}`}
                                            checked={light.isNew || false}
                                            onCheckedChange={(checked) => { updateLight(idx, 'isNew', checked); setIsDirty(true); }}
                                        />
                                        <Label htmlFor={`new-${idx}`} className="text-xs font-normal cursor-pointer">New Unit</Label>
                                    </div>
                                </CardContent>
                            </Card>
                            {idx === array.length - 1 && (
                                <Button onClick={addLight} className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Light
                                </Button>
                            )}
                            </div>
                        ))}
                    </div>
                )}

                <Card className="mt-6 print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">Report Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs">Overall Status</Label>
                            <Select value={overallStatus} onValueChange={(v) => { setOverallStatus(v); setIsDirty(true); }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pass">Pass</SelectItem>
                                    <SelectItem value="Fail">Fail</SelectItem>
                                    <SelectItem value="Conditional">Conditional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Additional Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
                                placeholder="Any additional notes or observations..."
                                className="h-24"
                            />
                        </div>
                    </CardContent>
                </Card>


                
                <Card className="mt-6 print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">Customer Acknowledgment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs">Customer Name</Label>
                            <Input
                                value={customerName}
                                onChange={(e) => { setCustomerName(e.target.value); setIsDirty(true); }}
                                placeholder="Enter customer name"
                            />
                        </div>
                        <SignaturePad
                            label="Customer Signature"
                            value={customerSignature}
                            onChange={(sig) => { setCustomerSignature(sig); setIsDirty(true); }}
                        />
                        <p className="text-xs text-slate-500">
                            By signing above, the customer acknowledges the completion of the emergency light inspection.
                        </p>
                    </CardContent>
                </Card>

                {/* Bottom Save Button */}
                <div className="no-print mt-6">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="lg"
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 relative overflow-hidden"
                    >
                        {isSaving && (
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 animate-pulse" />
                        )}
                        <span className="relative z-10 flex items-center">
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Report
                                </>
                            )}
                        </span>
                    </Button>
                </div>

                <p className="text-xs text-slate-500 text-center mt-6 print:hidden">
                    NFPA 101 & Manufacturer Requirements
                </p>

                {/* Print Footer */}
                <div className="hidden print:block print-footer">
                    <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/321b7a425_FooterLogo.png"
                        alt="NW Fire & Safety"
                        className="print-footer-logo"
                    />
                    <div className="print-footer-text">
                        <strong>Northwest Fire &amp; Safety, LLC</strong><br />
                        2517 N Van Buren • Enid, OK 73703<br />
                        (580) 540-3119 • www.nwfireandsafety.com
                    </div>
                </div>

                {/* Preview Dialog */}
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Report Preview</DialogTitle>
                        </DialogHeader>
                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </DialogContent>
                </Dialog>

                {/* Exit Confirmation Dialog */}
                <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                            <AlertDialogDescription>
                                You have unsaved changes. Are you sure you want to leave without saving?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Stay on Page</AlertDialogCancel>
                            <AlertDialogAction onClick={() => navigate(createPageUrl("InspectionDetails") + `?id=${inspectionId}`)}>
                                Leave Without Saving
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}