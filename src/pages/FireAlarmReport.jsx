import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Loader2,
    Bell,
    Printer,
    Camera,
    Copy,
    ChevronDown,
    RotateCcw,
    History,
    Save
} from "lucide-react";
import SignaturePad from "../components/inspections/SignaturePad";
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
import { useNavigate } from "react-router-dom";
import { useOfflineData } from "../components/offline/useOfflineData";
import { offlineStorage } from "../components/offline/offlineStorage";
import { useAutoSave } from "../components/reports/useAutoSave";

export default function FireAlarmReport() {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('id');
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        type_of_inspection: "",
        tag_status: "",
        control_panels: [],
        breaker_panel: "",
        facp_battery_date: "",
        facp_battery_quantity: "",
        facp_battery_size: "",
        monitoring_company: "",
        monitoring_phone: "",
        monitoring_account: "",
        monitoring_passcode: "",
        operating_sequence: {
            alarm_prealarm: "N/A",
            discharge: "N/A",
            manual_operation: "N/A"
        },
        input_devices: [],
        detector_photo_manufacturer: "",
        detector_ion_manufacturer: "",
        batteries_replaced: false,
        batteries_replaced_details: [],
        system_restored: false,
        system_restored_datetime: "",
        monitoring_called: false,
        monitoring_called_datetime: "",
        monitoring_restored: false,
        monitoring_restored_datetime: "",
        inspector: "",
        assisting_technicians: "",
        client_name: "",
        jobsite_hours: "",
        inspector_signature_url: "",
        client_signature_url: ""
    });

    const [showExitDialog, setShowExitDialog] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { isOnline, queueSync } = useOfflineData();

    const { data: inspection = [], isLoading: loadingInspection } = useQuery({
        queryKey: ['inspection', inspectionId],
        queryFn: async () => {
            const insp = await base44.entities.Inspection.get(inspectionId);
            return insp ? [insp] : [];
        },
        enabled: !!inspectionId,
    });

    const { data: existingReport = [], isLoading: loadingReport } = useQuery({
        queryKey: ['fireAlarmReport', inspectionId],
        queryFn: () => base44.entities.FireAlarmReport.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });
    useEffect(() => {
        if (existingReport?.[0]?.id) {
            reportIdRef.current = existingReport[0].id;
        }
    }, [existingReport]);
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

    // Latest ref (prevents stale closures)
    const latestRef = useRef(formData);

    // Prevent overlapping saves + prevent duplicate creates
    const saveInFlightRef = useRef(false);
    const reportIdRef = useRef(null);

    // Update latestRef whenever formData changes
    useEffect(() => {
        latestRef.current = formData;
    }, [formData]);

    const [isInitialized, setIsInitialized] = useState(false);

    // Helper to update form data
    const updateFormData = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        // Only proceed if not yet initialized and all necessary data is loaded (not loading)
        // inspectionId check ensures we have a context to load for
        if (isInitialized || loadingReport || loadingInspection || !inspectionId) return;

        const loadReportData = async () => {
            // Try to load from cache first if offline
            if (!isOnline) {
                const cachedData = await offlineStorage.getCachedData(`fire_alarm_report_${inspectionId}`);
                if (cachedData) {
                    setFormData(prev => ({
                        ...prev,
                        ...cachedData,
                        control_panels: cachedData.control_panels || [],
                        input_devices: cachedData.input_devices || [],
                        batteries_replaced_details: cachedData.batteries_replaced_details || [],
                        operating_sequence: {
                            ...prev.operating_sequence,
                            ...cachedData.operating_sequence,
                        }
                    }));
                    setIsInitialized(true);
                    return;
                }
            }

            if (existingReport.length > 0) {
                const reportData = existingReport[0];
                const newFormData = { ...reportData }; // Copy existing report data

                // Filter out the old top-level facp_photo_url from newFormData for consistency
                if (newFormData.facp_photo_url !== undefined) {
                    delete newFormData.facp_photo_url;
                }

                // Ensure array fields are initialized correctly and include photo_url for control panels
                let updatedControlPanels = (reportData.control_panels || []).map(panel => ({
                    // Ensure photo_url is always present in panel objects loaded from existing data
                    photo_url: "", // Default if not present in existing data
                    ...panel,
                }));

                // Special handling: if there's an old top-level facp_photo_url, apply it to the first control panel
                // This handles migration of old data structure to the new one (photo inside first panel)
                if (reportData.facp_photo_url) {
                    if (updatedControlPanels.length === 0) {
                        // If no control panels exist but there's an old FACP photo, create a default panel for it
                        updatedControlPanels.push({
                            manufacturer_model: "", line_voltage: "", battery_charge_level: "",
                            battery_load_test: "", battery_amp_hr_result: "", audible_visual_alarm: "",
                            audible_visual_trouble: "", remote_indicators: "", discharge_circuit: "",
                            service_lockout: "", remote_monitoring: "", comment: "",
                            photo_url: reportData.facp_photo_url // Assign old FACP photo to new panel's photo_url
                        });
                    } else {
                        // If control panels exist, assign the old FACP photo to the first one
                        updatedControlPanels[0].photo_url = reportData.facp_photo_url;
                    }
                }

                setFormData(prevData => ({
                    ...prevData,
                    ...newFormData, // Spread the modified newFormData (without top-level facp_photo_url)
                    control_panels: updatedControlPanels, // Use the specially handled control panels
                    input_devices: newFormData.input_devices || [],
                    batteries_replaced_details: newFormData.batteries_replaced_details || [],
                    operating_sequence: {
                        ...prevData.operating_sequence,
                        // Ensure operating_sequence from newFormData is used, but merge with prev for defaults
                        ...newFormData.operating_sequence,
                    }
                }));
                setIsInitialized(true); // Mark as initialized after loading existing report
            } else if (currentInspection?.inspector_name) {
                // Auto-populate inspector name from inspection if creating new report
                setFormData(prevData => ({
                    ...prevData,
                    inspector: currentInspection.inspector_name
                }));
                setIsInitialized(true); // Mark as initialized after setting inspector name
            } else if (currentInspection) {
                // If there's an inspection but no report and no inspector_name,
                // we still consider it initialized to prevent re-running.
                setIsInitialized(true);
            }
        };

        loadReportData();
    }, [existingReport, currentInspection, isOnline, inspectionId, loadingReport, loadingInspection, isInitialized]);

    const addControlPanel = () => {
        updateFormData('control_panels', [...formData.control_panels, {
            manufacturer_model: "",
            line_voltage: "",
            battery_charge_level: "",
            battery_load_test: "",
            battery_amp_hr_result: "",
            audible_visual_alarm: "",
            audible_visual_trouble: "",
            remote_indicators: "",
            discharge_circuit: "",
            service_lockout: "",
            remote_monitoring: "",
            comment: "",
            photo_url: ""
        }]);
    };

    const updateControlPanel = (index, field, value) => {
        const updated = [...formData.control_panels];
        if (updated[index]) {
            updated[index] = { ...updated[index], [field]: value };
            updateFormData('control_panels', updated);
        }
    };

    const removeControlPanel = (index) => {
        updateFormData('control_panels', formData.control_panels.filter((_, i) => i !== index));
    };

    const addInputDevice = () => {
        updateFormData('input_devices', [...formData.input_devices, {
            type: "",
            operation_test: "",
            circuit: "",
            location: "",
            sensitivity_setting: "",
            remarks: ""
        }]);
    };

    const updateInputDevice = (index, field, value) => {
        const updated = [...formData.input_devices];
        updated[index] = { ...updated[index], [field]: value };
        updateFormData('input_devices', updated);
    };

    const removeInputDevice = (index) => {
        updateFormData('input_devices', formData.input_devices.filter((_, i) => i !== index));
    };

    const addBatteryReplaced = () => {
        updateFormData('batteries_replaced_details', [...formData.batteries_replaced_details, { qty: "", size: "" }]);
    };

    const updateBatteryReplaced = (index, field, value) => {
        const updated = [...formData.batteries_replaced_details];
        updated[index] = { ...updated[index], [field]: value };
        updateFormData('batteries_replaced_details', updated);
    };

    const removeBatteryReplaced = (index) => {
        updateFormData('batteries_replaced_details', formData.batteries_replaced_details.filter((_, i) => i !== index));
    };

    const duplicateInputDevice = (index) => {
        const deviceToDuplicate = { ...formData.input_devices[index] };
        updateFormData('input_devices', [...formData.input_devices, deviceToDuplicate]);
    };

    const updateOperatingSequence = (field, value) => {
        setFormData(prev => ({
            ...prev,
            operating_sequence: {
                ...prev.operating_sequence,
                [field]: value
            }
        }));
    };
    const normalizeDateInput = (value) => {
        if (!value) return "";

        // If it's already YYYY-MM-DD, keep it
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

        // If it's YYYY-MM, convert to YYYY-MM-01 (safe default)
        if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;

        // If it's a full ISO string like 2026-02-20T...
        const isoMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) return isoMatch[1];

        return "";
    };
    // Moved autosave function here due to new implementation
    // Clean autosave with 4 rules
    const autoSaveFunction = async (currentData) => {
        if (!inspectionId) {
            return;
        }

        const data = {
            ...currentData,
            inspection_id: inspectionId,
        };

        if (isOnline) {
            const existingId = reportIdRef.current || existingReport?.[0]?.id;

            if (existingId) {
                await base44.entities.FireAlarmReport.update(existingId, data);
            } else {
                const created = await base44.entities.FireAlarmReport.create(data);
                if (created?.id) {
                    reportIdRef.current = created.id;
                }
            }

            await queryClient.invalidateQueries({ queryKey: ["fireAlarmReport", inspectionId] });
        } else {
            await offlineStorage.cacheData(`fire_alarm_report_${inspectionId}`, data);
            const existingId = reportIdRef.current || existingReport?.[0]?.id;

            if (existingId) {
                await queueSync("update_fire_alarm_report", { id: existingId, updates: data });
            } else {
                await queueSync("create_fire_alarm_report", data);
            }
        }

        return { id: reportIdRef.current || existingReport?.[0]?.id };
    };

    useAutoSave({
        data: formData,
        reportIdRef,
        saveInFlightRef,
        saveFunction: autoSaveFunction,
        localKey: `fire_alarm_report_${inspectionId}`,
        options: {
            delay: 3000,
            enabled: !!inspectionId
        }
    });

    // Manual Save Button = save + create backup snapshot
    const handleSave = async () => {
        console.log("handleSave called", { inspectionId, currentInspection, formData });
        
        if (!inspectionId) {
            toast.error("Missing inspection data");
            console.error("Missing inspection ID");
            return;
        }

        if (saveInFlightRef.current) {
            toast.info("Save already in progress...");
            return;
        }

        saveInFlightRef.current = true;
        setIsSaving(true);

        try {
            console.log("Calling autoSaveFunction with data:", formData);
            await autoSaveFunction(formData);
            console.log("autoSaveFunction completed");

            // Create backup snapshot
            const backupKey = `fireAlarmReportBackup:${inspectionId}:${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify({
                ...formData,
                inspection_id: inspectionId,
                property_id: currentInspection?.property_id || null,
                _backup_snapshot_ts: new Date().toISOString()
            }));

            toast.success("Report saved successfully");
        } catch (e) {
            console.error("Save error:", e);
            toast.error("Failed to save report");
        } finally {
            setIsSaving(false);
            saveInFlightRef.current = false;
        }
    };

    const handleBackClick = () => {
        navigate(createPageUrl("InspectionDetails") + `?id=${inspectionId}`);
    };

    if (loadingInspection || loadingReport) {
        return (
            <div className="min-h-screen bg-white p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-12 w-48" />
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
        <div className="min-h-screen print:bg-white">
            <style>{`
                @media print {
                    @page { margin: 0.3in 0.4in; size: letter; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { margin: 0; padding: 0; line-height: 1.15; font-size: 8pt; color: #000; }
                    .no-print { display: none !important; }
                    .print\\:hidden { display: none !important; }
                    .max-w-7xl { max-width: 100%; margin: 0; padding: 0; }
                    .px-4, .px-6, .px-8, .py-8 { padding: 0 !important; }
                    .space-y-6 > * + *, .space-y-4 > * + *, .space-y-3 > * + *, .space-y-2 > * + * { margin-top: 0.1rem !important; }
                    .mb-6, .mb-4, .mb-3, .mb-2, .mb-1 { margin-bottom: 0.1rem !important; }
                    .pb-3, .pb-6, .pb-2 { padding-bottom: 0 !important; }
                    .pt-6, .pt-4, .pt-2 { padding-top: 0.05rem !important; }
                    
                    /* Logo - larger centered */
                    .print-logo { height: 1.0in !important; width: auto !important; }
                    .logo-container { justify-content: center !important; margin-bottom: 0.1in !important; }
                    
                    /* Typography */
                    .text-2xl { font-size: 10pt !important; font-weight: bold; }
                    .text-xl { font-size: 9pt !important; font-weight: bold; }
                    .text-lg, .text-base { font-size: 8pt !important; }
                    .text-sm { font-size: 7pt !important; }
                    .text-xs { font-size: 6.5pt !important; }
                    
                    /* Remove all styling */
                    .rounded-2xl, .rounded-xl, .rounded-lg { border-radius: 0 !important; }
                    .shadow-lg, .shadow-sm, .shadow { box-shadow: none !important; border: none !important; }
                    .bg-gradient-to-r, .bg-red-500, .bg-slate-50, .bg-white { background: #fff !important; }
                    .border, .border-slate-200 { border: 0.5px solid #ccc !important; }
                    .border-t { border-top: 0.5px solid #ccc !important; }
                    
                    /* Padding/spacing */
                    .p-8, .p-6 { padding: 0.08rem 0.1rem !important; }
                    .p-4 { padding: 0.06rem 0.08rem !important; }
                    .p-2 { padding: 0.04rem !important; }
                    .gap-6, .gap-4, .gap-3, .gap-2 { gap: 0.08rem !important; }
                    
                    /* Grid layouts - more columns */
                    .grid { display: grid !important; gap: 0.08rem !important; }
                    .grid-cols-1 { grid-template-columns: 1fr; }
                    .grid-cols-2, .md\\:grid-cols-2 { grid-template-columns: 1fr 1fr; }
                    .grid-cols-3, .print\\:grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
                    .grid-cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
                    .lg\\:grid-cols-2 { grid-template-columns: 1fr 1fr; }
                    
                    /* Tables */
                    table { width: 100%; border-collapse: collapse; font-size: 7pt; margin: 0.05rem 0; }
                    td, th { padding: 0.03rem 0.05rem; font-size: 7pt; border: 0.5px solid #ddd; vertical-align: top; }
                    th { font-weight: bold; background: #f8f8f8; }
                    
                    /* Cards - minimal borders */
                    .Card { border: none !important; margin-bottom: 0.08rem !important; }
                    
                    /* Labels & inputs */
                    label { font-size: 6.5pt !important; font-weight: 600; text-transform: uppercase; }
                    
                    /* Hide image upload areas, show only images */
                    input[type="file"] { display: none !important; }
                    img { display: block !important; max-width: 100% !important; height: auto !important; max-height: 1.5in !important; }
                    
                    /* Compact sections */
                    .print-compact { margin: 0.05rem 0 !important; padding: 0.05rem 0 !important; }
                    
                    /* Print-specific tables */
                    .print-table { font-size: 6.5pt; }
                    .print-table td { padding: 0.02rem 0.04rem; }
                    
                    /* Prevent page breaks inside sections */
                    .print-no-break { 
                        page-break-inside: avoid !important; 
                        break-inside: avoid !important;
                        max-height: 3in !important;
                        overflow: hidden !important;
                    }
                    
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
                        style={{ height: '90px', width: 'auto', margin: '0 auto', display: 'block' }}
                    />
                    <div style={{ fontSize: '7pt', marginTop: '0.05in', lineHeight: '1.2' }}>
                        <div style={{ fontWeight: 'bold' }}>Northwest Fire & Safety, LLC</div>
                        <div>580-540-3119 | 2517 N Van Buren - Enid, OK 73703</div>
                    </div>
                    <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginTop: '0.1in', marginBottom: '0.05in' }}>FIRE ALARM INSPECTION REPORT</h2>
                </div>

                {/* Header */}
                <div className="no-print print:hidden mb-6 space-y-3">
                    <div className="flex items-center gap-2">
                        <Link to={createPageUrl("InspectionDetails") + `?id=${inspectionId}`} onClick={handleBackClick}>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="p-2 rounded-xl bg-red-500">
                            <Bell className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                                Fire Alarm Inspection Report
                            </h1>
                            <p className="text-slate-500 text-xs truncate">
                                {isSaving ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                                    </span>
                                ) : (
                                    <span>Saved</span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || loadingInspection}
                                className="h-9 px-3"
                                title={loadingInspection ? "Loading inspection data..." : ""}
                            >
                                {isSaving || loadingInspection ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Save
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 px-3" onClick={() => setShowPreview(true)}>
                                <Camera className="h-4 w-4 mr-2" />
                                Preview
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 px-3" onClick={() => window.print()}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                        </div>
                    </div>
                </div>



                {/* Client & Property Info */}
                <div className="hidden print:block mb-1">
                    <table className="print-table">
                        <tbody>
                            <tr>
                                <td style={{ width: "33%" }}><strong>Client:</strong> {client?.company_name || "N/A"}</td>
                                <td style={{ width: "34%" }}><strong>Inspection:</strong> {formData.type_of_inspection || "N/A"}</td>
                                <td style={{ width: "33%" }}><strong>Date:</strong> {currentInspection.scheduled_date ? format(new Date(currentInspection.scheduled_date), "MM/dd/yyyy") : "N/A"}</td>
                            </tr>
                            <tr>
                                <td><strong>Client Address:</strong> {client?.address || "N/A"}</td>
                                <td><strong>Property:</strong> {property?.address || client?.address || "N/A"}</td>
                                <td><strong>Phone:</strong> {client?.phone || "N/A"}</td>
                            </tr>
                            <tr>
                                <td colSpan="3"><strong>Contact:</strong> {client?.contact_name || "N/A"}</td>
                            </tr>
                            <tr>
                                <td><strong>Inspector:</strong> {formData.inspector?.split(" ")[0] || "N/A"}</td>
                                <td><strong>Client Rep:</strong> {formData.client_name || "N/A"}</td>
                                <td><strong>Hours:</strong> {formData.jobsite_hours || "N/A"}</td>
                            </tr>
                            <tr>
                                <td colSpan="3"><strong>Tag:</strong> {formData.tag_status || "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <Card className="mb-4 print:hidden">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Client</Label>
                                <p className="font-semibold text-slate-900">{client?.company_name || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Type of Inspection *</Label>
                                <Select
                                    value={formData.type_of_inspection}
                                    onValueChange={(value) => {
                                        updateFormData('type_of_inspection', value);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Annual">Annual</SelectItem>
                                        <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                                        <SelectItem value="Repair">Repair</SelectItem>
                                        <SelectItem value="Install">Install</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Address</Label>
                                <p className="font-medium text-slate-900">{property?.address || client?.address || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Inspection Date</Label>
                                <p className="font-medium text-slate-900">
                                    {currentInspection.scheduled_date
                                        ? format(new Date(currentInspection.scheduled_date), "MMM d, yyyy")
                                        : "N/A"}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Contact</Label>
                                <p className="font-medium text-slate-900">{client?.contact_name || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Phone #</Label>
                                <p className="font-medium text-slate-900">{client?.phone || "N/A"}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Tag Status *</Label>
                                <Select
                                    value={formData.tag_status}
                                    onValueChange={(value) => {
                                        updateFormData('tag_status', value);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tag status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Green Tag">Green Tag</SelectItem>
                                        <SelectItem value="Yellow Tag">Yellow Tag</SelectItem>
                                        <SelectItem value="Red Tag">Red Tag</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500 uppercase">Jobsite Hours *</Label>
                                <Select
                                    value={formData.jobsite_hours}
                                    onValueChange={(value) => {
                                        updateFormData('jobsite_hours', value);
                                    }}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select hours" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5).map(num => (
                                            <SelectItem key={num} value={num.toString()}>{num} hours</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Control Panels - Condensed Print View */}
                <div className="hidden print:block mb-1">
                    {formData.control_panels.length > 0 && (
                        <>
                            <h3 className="text-sm font-bold mb-1">Control Panels</h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Mfr/Model</th>
                                        <th>Voltage</th>
                                        <th>Batt Charge</th>
                                        <th>Load Test</th>
                                        <th>Alarm</th>
                                        <th>Monitoring</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.control_panels.map((panel, idx) => (
                                        <tr key={idx}>
                                            <td>{panel.manufacturer_model || "-"}</td>
                                            <td>{panel.line_voltage || "-"}</td>
                                            <td>{panel.battery_charge_level || "-"}</td>
                                            <td>{panel.battery_load_test || "-"}</td>
                                            <td>{panel.audible_visual_alarm || "-"}</td>
                                            <td>{panel.remote_monitoring || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                    {formData.control_panels[0]?.photo_url && (
                        <div style={{ marginTop: "0.08in" }}>
                            <h3 className="text-sm font-bold mb-1">Control Panel Photo</h3>
                            <img
                                src={formData.control_panels[0]?.photo_url}
                                alt="Control Panel"
                                style={{ maxHeight: "2in", width: "auto", border: "0.5px solid #ccc" }}
                            />
                        </div>
                    )}
                </div>

                {/* Control Panel Section - Screen View */}
                <Card className="mb-3 print:hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-2">
                        <CardTitle className="print:text-base">Control Panels</CardTitle>
                        <Button onClick={addControlPanel} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Control Panel Photo Upload */}
                        <Card className="border-slate-200 bg-slate-50">
                            <CardContent className="p-2">
                                <Label className="text-xs mb-1 block">Control Panel Photo</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            try {
                                                let file_url;

                                                if (isOnline) {
                                                    // Online - upload directly
                                                    const result = await base44.integrations.Core.UploadFile({ file });
                                                    file_url = result.file_url;
                                                } else {
                                                    // Offline - convert to base64 and store locally
                                                    const reader = new FileReader();
                                                    await new Promise((resolve) => {
                                                        reader.onload = async (event) => {
                                                            const photoData = event.target.result;
                                                            file_url = photoData; // Use base64 as temporary URL

                                                            // Save to offline storage for later upload
                                                            await offlineStorage.saveOfflinePhoto(inspectionId, photoData);
                                                            await queueSync('upload_photo', {
                                                                inspectionId,
                                                                photoData,
                                                                filename: file.name
                                                            });

                                                            toast.success("Photo saved offline - will upload when connected");
                                                            resolve();
                                                        };
                                                        reader.readAsDataURL(file);
                                                    });
                                                }

                                                if (formData.control_panels.length === 0) {
                                                    const newPanel = {
                                                        manufacturer_model: "", line_voltage: "", battery_charge_level: "",
                                                        battery_load_test: "", battery_amp_hr_result: "", audible_visual_alarm: "",
                                                        audible_visual_trouble: "", remote_indicators: "", discharge_circuit: "",
                                                        service_lockout: "", remote_monitoring: "", comment: "",
                                                        photo_url: file_url
                                                    };
                                                    updateFormData('control_panels', [newPanel]);
                                                } else {
                                                    updateControlPanel(0, 'photo_url', file_url);
                                                }
                                            } catch (error) {
                                                console.error("Photo error:", error);
                                                toast.error("Failed to save photo");
                                            }
                                        }
                                    }}
                                    className="mb-1 text-xs h-8"
                                />
                                {formData.control_panels[0]?.photo_url && (
                                    <div className="relative rounded overflow-hidden border border-slate-200 mt-1">
                                        <img
                                            src={formData.control_panels[0]?.photo_url}
                                            alt="Control Panel"
                                            className="w-full h-auto max-h-24 object-contain"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="absolute top-1 right-1 h-6 w-6 p-0"
                                            onClick={() => {
                                                if (formData.control_panels.length > 0) {
                                                    updateControlPanel(0, 'photo_url', "");
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {formData.control_panels.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">No control panels added</p>
                        ) : (
                            formData.control_panels.map((panel, idx) => (
                                <Card key={idx} className="border-slate-200">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-sm font-semibold text-slate-700">Panel {idx + 1}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeControlPanel(idx)}
                                                className="h-8 text-rose-500 hover:text-rose-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="sm:col-span-2">
                                                <Label className="text-xs">Manufacturer & Model</Label>
                                                <Input
                                                    value={panel.manufacturer_model}
                                                    onChange={(e) => updateControlPanel(idx, 'manufacturer_model', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Line Voltage</Label>
                                                <Select
                                                    value={panel.line_voltage}
                                                    onValueChange={(value) => updateControlPanel(idx, 'line_voltage', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Battery Charge Level</Label>
                                                <Select
                                                    value={panel.battery_charge_level}
                                                    onValueChange={(value) => updateControlPanel(idx, 'battery_charge_level', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Battery Load Test</Label>
                                                <Select
                                                    value={panel.battery_load_test}
                                                    onValueChange={(value) => updateControlPanel(idx, 'battery_load_test', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Battery Amp HR</Label>
                                                <Select
                                                    value={panel.battery_amp_hr_result}
                                                    onValueChange={(value) => updateControlPanel(idx, 'battery_amp_hr_result', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Audible/Visual Alarm</Label>
                                                <Select
                                                    value={panel.audible_visual_alarm}
                                                    onValueChange={(value) => updateControlPanel(idx, 'audible_visual_alarm', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Audible/Visual Trouble</Label>
                                                <Select
                                                    value={panel.audible_visual_trouble}
                                                    onValueChange={(value) => updateControlPanel(idx, 'audible_visual_trouble', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Remote Indicators</Label>
                                                <Select
                                                    value={panel.remote_indicators}
                                                    onValueChange={(value) => updateControlPanel(idx, 'remote_indicators', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="N/A" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Remote Monitoring</Label>
                                                <Select
                                                    value={panel.remote_monitoring}
                                                    onValueChange={(value) => updateControlPanel(idx, 'remote_monitoring', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select result" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <Label className="text-xs">Comment</Label>
                                                <Input
                                                    value={panel.comment}
                                                    onChange={(e) => updateControlPanel(idx, 'comment', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Breaker & Battery - Condensed Print */}
                <div className="hidden print:block mb-1">
                    <table className="print-table">
                        <tbody>
                            <tr>
                                <td style={{ width: "25%" }}><strong>Breaker Panel:</strong></td>
                                <td style={{ width: "25%" }}>{formData.breaker_panel || "N/A"}</td>
                                <td style={{ width: "25%" }}><strong>Battery Date:</strong></td>
                                <td style={{ width: "25%" }}>{formData.facp_battery_date ? format(new Date(formData.facp_battery_date), "MM/dd/yyyy") : "N/A"}</td>
                            </tr>
                            <tr>
                                <td><strong>Battery Qty:</strong></td>
                                <td>{formData.facp_battery_quantity || "N/A"}</td>
                                <td><strong>Battery Size:</strong></td>
                                <td>{formData.facp_battery_size || "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Breaker Panel & Battery Info - Screen View */}
                <div className="grid grid-cols-1 gap-4 mb-6 print:hidden">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Breaker Panel</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                value={formData.breaker_panel}
                                onChange={(e) => updateFormData('breaker_panel', e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">FACP Battery Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label className="text-xs">Date</Label>
                                <Input
                                    type="date"
                                    value={normalizeDateInput(formData.facp_battery_date)}
                                    onChange={(e) => updateFormData('facp_battery_date', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Quantity</Label>
                                    <Select
                                        value={formData.facp_battery_quantity}
                                        onValueChange={(value) => updateFormData('facp_battery_quantity', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select quantity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 21 }, (_, i) => i).map(num => (
                                                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Size</Label>
                                    <Select
                                        value={formData.facp_battery_size}
                                        onValueChange={(value) => updateFormData('facp_battery_size', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="6V 4.5AH">6V 4.5AH</SelectItem>
                                            <SelectItem value="6V 10AH">6V 10AH</SelectItem>
                                            <SelectItem value="12V 7AH">12V 7AH</SelectItem>
                                            <SelectItem value="12V 8AH">12V 8AH</SelectItem>
                                            <SelectItem value="12V 10AH">12V 10AH</SelectItem>
                                            <SelectItem value="12V 18AH">12V 18AH</SelectItem>
                                            <SelectItem value="12V 24AH">12V 24AH</SelectItem>
                                            <SelectItem value="24V 7AH">24V 7AH</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Batteries Replaced Section */}
                <Card className="mb-6 print:hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base">Batteries Replaced</CardTitle>
                        <Button onClick={addBatteryReplaced} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Battery
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                            <Checkbox
                                checked={formData.batteries_replaced}
                                onCheckedChange={(checked) => updateFormData('batteries_replaced', checked)}
                            />
                            <Label className="text-sm">Batteries were replaced during this inspection</Label>
                        </div>

                        {formData.batteries_replaced_details.length === 0 ? (
                            <p className="text-center text-slate-500 py-6">No batteries added</p>
                        ) : (
                            <div className="space-y-3">
                                {formData.batteries_replaced_details.map((battery, idx) => (
                                    <div key={idx} className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <Label className="text-xs">Quantity</Label>
                                            <Select
                                                value={battery.qty?.toString() || ""}
                                                onValueChange={(value) => updateBatteryReplaced(idx, 'qty', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select qty" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs">Battery Size</Label>
                                            <Select
                                                value={battery.size || ""}
                                                onValueChange={(value) => updateBatteryReplaced(idx, 'size', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select size" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="6V 4.5AH">6V 4.5AH</SelectItem>
                                                    <SelectItem value="6V 10AH">6V 10AH</SelectItem>
                                                    <SelectItem value="12V 7AH">12V 7AH</SelectItem>
                                                    <SelectItem value="12V 8AH">12V 8AH</SelectItem>
                                                    <SelectItem value="12V 10AH">12V 10AH</SelectItem>
                                                    <SelectItem value="12V 18AH">12V 18AH</SelectItem>
                                                    <SelectItem value="12V 24AH">12V 24AH</SelectItem>
                                                    <SelectItem value="24V 7AH">24V 7AH</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeBatteryReplaced(idx)}
                                            className="h-9 text-rose-500 hover:text-rose-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Monitoring - Condensed Print */}
                <div className="hidden print:block mb-1">
                    <table className="print-table">
                        <tbody>
                            <tr>
                                <td style={{ width: "25%" }}><strong>Monitoring Co:</strong></td>
                                <td style={{ width: "25%" }}>{formData.monitoring_company || "N/A"}</td>
                                <td style={{ width: "25%" }}><strong>Phone:</strong></td>
                                <td style={{ width: "25%" }}>{formData.monitoring_phone || "N/A"}</td>
                            </tr>
                            <tr>
                                <td><strong>Account #:</strong></td>
                                <td>{formData.monitoring_account || "N/A"}</td>
                                <td><strong>Passcode:</strong></td>
                                <td>{formData.monitoring_passcode || "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Monitoring Station Info - Screen View */}
                <Card className="mb-6 print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">Monitoring Station Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4">
                        <div>
                            <Label>Monitoring Company</Label>
                            <Input
                                value={formData.monitoring_company}
                                onChange={(e) => updateFormData('monitoring_company', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Phone Number</Label>
                            <Input
                                value={formData.monitoring_phone}
                                onChange={(e) => updateFormData('monitoring_phone', e.target.value.replace(/[^0-9]/g, ''))} // Remove non-digits
                            />
                        </div>
                        <div>
                            <Label>Account Number</Label>
                            <Input
                                value={formData.monitoring_account}
                                onChange={(e) => updateFormData('monitoring_account', e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Passcode</Label>
                            <Input
                                value={formData.monitoring_passcode}
                                onChange={(e) => updateFormData('monitoring_passcode', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Operating Sequence - Condensed Print */}
                <div className="hidden print:block mb-1">
                    <table className="print-table">
                        <tbody>
                            <tr>
                                <td style={{ width: "33%" }}><strong>Alarm/Pre-Alarm:</strong> {formData.operating_sequence.alarm_prealarm}</td>
                                <td style={{ width: "34%" }}><strong>Discharge:</strong> {formData.operating_sequence.discharge}</td>
                                <td style={{ width: "33%" }}><strong>Manual Op:</strong> {formData.operating_sequence.manual_operation}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Operating Sequence - Screen View */}
                <Card className="mb-6 print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">Operating Sequence</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-sm font-semibold mb-2">Alarm/Pre-Alarm</Label>
                            <Select
                                value={formData.operating_sequence.alarm_prealarm}
                                onValueChange={(value) => updateOperatingSequence('alarm_prealarm', value)}
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
                        <div>
                            <Label className="text-sm font-semibold mb-2">Discharge</Label>
                            <Select
                                value={formData.operating_sequence.discharge}
                                onValueChange={(value) => updateOperatingSequence('discharge', value)}
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
                        <div>
                            <Label className="text-sm font-semibold mb-2">Manual Operation</Label>
                            <Select
                                value={formData.operating_sequence.manual_operation}
                                onValueChange={(value) => updateOperatingSequence('manual_operation', value)}
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
                    </CardContent>
                </Card>

                {/* Input Devices - Condensed Print */}
                <div className="hidden print:block mb-1">
                    {formData.input_devices.length > 0 && (
                        <>
                            <h3 className="text-sm font-bold mb-1">Input Devices</h3>
                            <table className="print-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Test</th>
                                        <th>Zone</th>
                                        <th>Location</th>
                                        <th>Sensitivity</th>
                                        <th>Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.input_devices.map((device, idx) => (
                                        <tr key={idx}>
                                            <td>{device.type || "-"}</td>
                                            <td>{device.operation_test || "-"}</td>
                                            <td>{device.circuit || "-"}</td>
                                            <td>{device.location || "-"}</td>
                                            <td>{device.sensitivity_setting || "-"}</td>
                                            <td>{device.remarks || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: "0.05in", fontSize: "6.5pt" }}>
                                <div><strong>Photo Detector Mfr/Part#:</strong> {formData.detector_photo_manufacturer || "N/A"}</div>
                                <div><strong>ION Detector Mfr/Part#:</strong> {formData.detector_ion_manufacturer || "N/A"}</div>
                            </div>
                        </>
                    )}
                </div>

                {/* Input Devices - Screen View */}
                <Card className="mb-6 print:hidden">
                    <CardHeader>
                        <div>
                            <CardTitle>Input Devices</CardTitle>
                            <p className="text-xs text-slate-500 mt-1">Detectors, Manual Stations, Switches</p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {formData.input_devices.length === 0 ? (
                            <p className="text-center text-slate-500 py-8">No input devices added</p>
                        ) : (
                            formData.input_devices.map((device, idx) => (
                                <Card key={idx} className="border-slate-200">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-sm font-semibold text-slate-700">Device {idx + 1}</span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => duplicateInputDevice(idx)}
                                                    className="h-8 text-slate-600 hover:text-slate-900"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeInputDevice(idx)}
                                                    className="h-8 text-rose-500 hover:text-rose-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-xs">Type</Label>
                                                <div className="relative">
                                                    <Input
                                                        list={`device-types-${idx}`}
                                                        value={device.type}
                                                        onChange={(e) => updateInputDevice(idx, 'type', e.target.value)}
                                                        placeholder="Select or type device type"
                                                        className="pr-8"
                                                    />
                                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                                </div>
                                                <datalist id={`device-types-${idx}`}>
                                                    <option value="Smoke Detector" />
                                                    <option value="Heat Detector" />
                                                    <option value="Pull Station" />
                                                    <option value="Water Flow" />
                                                    <option value="Tamper Switch" />
                                                    <option value="Duct Detector" />
                                                    <option value="Beam Detector" />
                                                    <option value="Horn/Strobe" />
                                                    <option value="Speaker/Strobe" />
                                                    <option value="Supervisory Zone" />
                                                    <option value="Monitor Zone" />
                                                </datalist>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Operation Test</Label>
                                                <Select
                                                    value={device.operation_test}
                                                    onValueChange={(value) => updateInputDevice(idx, 'operation_test', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select result" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pass">Pass</SelectItem>
                                                        <SelectItem value="Fail">Fail</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label className="text-xs">Address/Zone</Label>
                                                <Input
                                                    value={device.circuit}
                                                    onChange={(e) => updateInputDevice(idx, 'circuit', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Location</Label>
                                                <Input
                                                    value={device.location}
                                                    onChange={(e) => updateInputDevice(idx, 'location', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Sensitivity</Label>
                                                <Input
                                                    value={device.sensitivity_setting}
                                                    onChange={(e) => updateInputDevice(idx, 'sensitivity_setting', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Remarks</Label>
                                                <Input
                                                    value={device.remarks}
                                                    onChange={(e) => updateInputDevice(idx, 'remarks', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}

                        {formData.input_devices.length > 0 && (
                            <div className="flex justify-center pt-2">
                                <Button onClick={addInputDevice} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Device
                                </Button>
                            </div>
                        )}

                        {formData.input_devices.length === 0 && (
                            <div className="flex justify-center py-8">
                                <Button onClick={addInputDevice} size="sm" variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add First Device
                                </Button>
                            </div>
                        )}

                        <div className="pt-4 border-t space-y-3">
                            <div>
                                <Label className="text-xs">Detector Photo Manufacturer/Part #</Label>
                                <Input
                                    value={formData.detector_photo_manufacturer}
                                    onChange={(e) => updateFormData('detector_photo_manufacturer', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label className="text-xs">Detector ION Manufacturer/Part #</Label>
                                <Input
                                    value={formData.detector_ion_manufacturer}
                                    onChange={(e) => updateFormData('detector_ion_manufacturer', e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* System Restoration - Condensed Print */}
                <div className="hidden print:block mb-1">
                    <table className="print-table">
                        <tbody>
                            <tr>
                                <td style={{ width: "50%" }}><strong>System Restored:</strong> {formData.system_restored ? "Yes" : "No"} {formData.system_restored_datetime && `- ${format(new Date(formData.system_restored_datetime), "MM/dd/yy HH:mm")}`}</td>
                                <td style={{ width: "50%" }}><strong>Monitoring Called:</strong> {formData.monitoring_called ? "Yes" : "No"} {formData.monitoring_called_datetime && `- ${format(new Date(formData.monitoring_called_datetime), "MM/dd/yy HH:mm")}`}</td>
                            </tr>
                            <tr>
                                <td colSpan="2"><strong>Monitoring Restored:</strong> {formData.monitoring_restored ? "Yes" : "No"} {formData.monitoring_restored_datetime && `- ${format(new Date(formData.monitoring_restored_datetime), "MM/dd/yy HH:mm")}`}</td>
                            </tr>
                            <tr>
                                <td><strong>Assisting Techs:</strong> {formData.assisting_technicians || "N/A"}</td>
                                <td><strong>Client Name:</strong> {formData.client_name || "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Signatures */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.15in", marginTop: "0.1in" }}>
                        {formData.inspector_signature_url && (
                            <div style={{ border: "0.5px solid #ccc", padding: "0.05in" }}>
                                <div style={{ fontSize: "6.5pt", fontWeight: "bold", marginBottom: "0.02in" }}>Inspector Signature</div>
                                <img src={formData.inspector_signature_url} alt="Inspector Signature" style={{ maxHeight: "0.6in", width: "100%" }} />
                            </div>
                        )}
                        {formData.client_signature_url && (
                            <div style={{ border: "0.5px solid #ccc", padding: "0.05in" }}>
                                <div style={{ fontSize: "6.5pt", fontWeight: "bold", marginBottom: "0.02in" }}>Customer Signature</div>
                                <img src={formData.client_signature_url} alt="Customer Signature" style={{ maxHeight: "0.6in", width: "100%" }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* System Restoration & Signatures - Screen View */}
                <Card className="mb-6 print:hidden">
                    <CardHeader>
                        <CardTitle className="text-base">System Restoration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={formData.system_restored}
                                        onCheckedChange={(checked) => updateFormData('system_restored', checked)}
                                    />
                                    <Label className="text-sm">System Restored To Normal?</Label>
                                </div>
                                <Input
                                    type="datetime-local"
                                    value={formData.system_restored_datetime}
                                    onChange={(e) => updateFormData('system_restored_datetime', e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={formData.monitoring_called}
                                        onCheckedChange={(checked) => updateFormData('monitoring_called', checked)}
                                    />
                                    <Label className="text-sm">Monitoring Called & Verified?</Label>
                                </div>
                                <Input
                                    type="datetime-local"
                                    value={formData.monitoring_called_datetime}
                                    onChange={(e) => updateFormData('monitoring_called_datetime', e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={formData.monitoring_restored}
                                        onCheckedChange={(checked) => updateFormData('monitoring_restored', checked)}
                                    />
                                    <Label className="text-sm">Monitoring Restored?</Label>
                                </div>
                                <Input
                                    type="datetime-local"
                                    value={formData.monitoring_restored_datetime}
                                    onChange={(e) => updateFormData('monitoring_restored_datetime', e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-6 border-t">
                            <div>
                                <Label>Inspector *</Label>
                                <Input
                                    value={formData.inspector}
                                    onChange={(e) => updateFormData('inspector', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Assisting Technicians</Label>
                                <Input
                                    value={formData.assisting_technicians}
                                    onChange={(e) => updateFormData('assisting_technicians', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Client Name</Label>
                                <Input
                                    value={formData.client_name}
                                    onChange={(e) => updateFormData('client_name', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t space-y-6">
                            <SignaturePad
                                label="Inspector Signature"
                                value={formData.inspector_signature_url}
                                onChange={(url) => updateFormData('inspector_signature_url', url)}
                            />

                            <SignaturePad
                                label="Customer Signature"
                                value={formData.client_signature_url}
                                onChange={(url) => updateFormData('client_signature_url', url)}
                            />
                            <p className="text-xs text-slate-500">
                                By signing above, I acknowledge that the inspection has been completed and reviewed.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview Dialog */}
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle>Report Preview</DialogTitle>
                        </DialogHeader>
                        <div className="bg-white p-8" style={{
                            fontSize: '8pt',
                            lineHeight: '1.15',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                            {/* Logo */}
                            <div className="flex justify-center mb-2">
                                <img
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/ab5e51f05_LOGO-2024-BlackSurround.jpg"
                                    alt="NW Fire & Safety"
                                    style={{ height: '0.8in', width: 'auto' }}
                                />
                            </div>

                            {/* Company Info */}
                            <div className="text-center mb-3 text-xs leading-tight">
                                <div>Northwest Fire & Safety, LLC</div>
                                <div>580-540-3119</div>
                                <div>2517 N Van Buren - Enid, OK 73703</div>
                                <div>www.nwfireandsafety.com</div>
                                <div>OK # AC441117, 466</div>
                            </div>

                            {/* Report Title */}
                            <div className="text-center mb-3">
                                <h2 className="font-bold text-lg">FIRE ALARM INSPECTION REPORT</h2>
                                <p className="text-xs mt-1">NFPA 72 Compliance - IFC & State of Oklahoma</p>
                            </div>

                            {/* Rest of the report content - using existing print layout */}
                            <div className="space-y-2">
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Client:</strong> {client?.company_name || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Inspection:</strong> {formData.type_of_inspection || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Date:</strong> {currentInspection.scheduled_date ? format(new Date(currentInspection.scheduled_date), "MM/dd/yyyy") : "N/A"}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Address:</strong> {client?.address || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Property:</strong> {property?.address || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Phone:</strong> {client?.phone || "N/A"}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Inspector:</strong> {formData.inspector?.split(" ")[0] || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Tag:</strong> {formData.tag_status || "N/A"}</td>
                                            <td style={{ border: '0.5px solid #ddd', padding: '2px 4px' }}><strong>Hours:</strong> {formData.jobsite_hours || "N/A"}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Print Footer */}
                <div className="hidden print-only print-footer">
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

                {/* Exit Confirmation Dialog - now won't appear as no dirty state */}
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