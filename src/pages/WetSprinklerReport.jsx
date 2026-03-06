import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import SignaturePad from "@/components/inspections/SignaturePad";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Save, AlertCircle, Eye } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useAutoSave } from "../components/reports/useAutoSave";
import AutoSaveIndicator from "../components/reports/AutoSaveIndicator";
import { useOfflineData } from "../components/offline/useOfflineData";
import { offlineStorage } from "../components/offline/offlineStorage";
import { toast } from "sonner";

export default function WetSprinklerReport() {
    const [showExitAlert, setShowExitAlert] = useState(false);
    const [showSaveAlert, setShowSaveAlert] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState("form");
    const [showPreview, setShowPreview] = useState(false);
    const { isOnline, queueSync } = useOfflineData();

    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get("inspection_id");

    // Initialize report state before useAutoSave
    const [report, setReport] = useState({
        service_date: "",
        service_type: "annual",
        system_tag: "Green Tag",
        main_valve_status: "Pass",
        pressure_gauge_reading: "",
        flow_test_completed: false,
        flow_test_results: "",
        sprinkler_heads: [],
        drain_test_completed: false,
        drain_test_results: "",
        obstruction_test_completed: false,
        obstruction_test_results: "",
        standpipe_condition: "N/A",
        backflow_device_status: "N/A",
        deficiencies: "",
        follow_up_required: false,
        follow_up_notes: "",
        technician_name: "",
        technician_license: "",
        technician_signature_url: "",
        customer_name: "",
        customer_signature_url: "",
        notes: "",
    });

    const [address, setAddress] = useState("");

    // Fetch inspection and related data
    const { data: inspection, isLoading: inspectionLoading } = useQuery({
        queryKey: ["inspection", inspectionId],
        queryFn: () => inspectionId ? base44.entities.Inspection.filter({ id: inspectionId }) : null,
        enabled: !!inspectionId,
    });

    const { data: properties } = useQuery({
        queryKey: ["properties"],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: clients } = useQuery({
        queryKey: ["clients"],
        queryFn: () => base44.entities.Client.list(),
    });

    const { data: existingReports } = useQuery({
        queryKey: ["wetSprinklerReports", inspectionId],
        queryFn: () => inspectionId ? base44.entities.WetSprinklerReport.filter({ inspection_id: inspectionId }) : null,
        enabled: !!inspectionId,
    });



    // Load existing report data
    useEffect(() => {
        const loadReportData = async () => {
            // Try to load from cache first if offline
            if (!isOnline) {
                const cachedData = await offlineStorage.getCachedData(`wet_sprinkler_report_${inspectionId}`);
                if (cachedData) {
                    setReport(cachedData);
                    return;
                }
            }
            
            if (existingReports && existingReports.length > 0) {
                const existing = existingReports[0];
                setReport(existing);
            }
        };
        
        loadReportData();
    }, [existingReports, isOnline, inspectionId]);

    // Auto-populate address
    useEffect(() => {
        if (inspection && inspection.length > 0 && properties && clients) {
            const inspectionData = inspection[0];
            const property = properties.find(p => p.id === inspectionData?.property_id);
            const client = clients.find(c => c.id === inspectionData?.client_id);
            
            if (property?.address) {
                setAddress(property.address);
            } else if (client?.address) {
                setAddress(client.address);
            }
        }
    }, [inspection, properties, clients]);

    // Track changes
    const handleReportChange = (updates) => {
        setReport({ ...report, ...updates });
        setIsDirty(true);
    };

    // Sprinkler head management
    const addSprinklerHead = () => {
        setReport({
            ...report,
            sprinkler_heads: [...report.sprinkler_heads, { location: "", condition: "Pass", notes: "" }]
        });
        setIsDirty(true);
    };

    const updateSprinklerHead = (index, updates) => {
        const updated = [...report.sprinkler_heads];
        updated[index] = { ...updated[index], ...updates };
        setReport({ ...report, sprinkler_heads: updated });
        setIsDirty(true);
    };

    const removeSprinklerHead = (index) => {
        setReport({
            ...report,
            sprinkler_heads: report.sprinkler_heads.filter((_, i) => i !== index)
        });
        setIsDirty(true);
    };

    // Save report
    async function handleSave() {
        setIsSaving(true);
        try {
            const inspectionData = inspection?.[0];
            const reportData = {
                ...report,
                inspection_id: inspectionData?.id,
                property_id: inspectionData?.property_id,
                client_id: inspectionData?.client_id,
            };

            if (isOnline) {
                // Online - save directly
                if (existingReports?.length > 0) {
                    await base44.entities.WetSprinklerReport.update(existingReports[0].id, reportData);
                } else {
                    await base44.entities.WetSprinklerReport.create(reportData);
                }

                // Update inspection notes with report summary
                const summary = `Wet Sprinkler Report - ${report.service_type} - Tag: ${report.system_tag}`;
                await base44.entities.Inspection.update(inspectionData?.id, {
                    notes: `${inspectionData?.notes || ""}\n\n${summary}`
                });
                
                // Auto-create deficiencies if there are any
                if (report.deficiencies && report.deficiencies.trim()) {
                    const existingDeficiencies = await base44.entities.Deficiency.filter({ 
                        inspection_id: inspectionId,
                        category: "sprinkler_system"
                    });
                    
                    if (existingDeficiencies.length === 0) {
                        await base44.entities.Deficiency.create({
                            inspection_id: inspectionId,
                            property_id: inspectionData?.property_id,
                            client_id: inspectionData?.client_id,
                            title: "Wet Sprinkler System Issues",
                            description: report.deficiencies,
                            severity: report.system_tag === "Red Tag" ? "critical" : report.system_tag === "Yellow Tag" ? "high" : "medium",
                            category: "sprinkler_system",
                            status: "open"
                        });
                    }
                }

                setIsDirty(false);
                setShowSaveAlert(true);
            } else {
                // Offline - cache and queue for sync
                await offlineStorage.cacheData(`wet_sprinkler_report_${inspectionId}`, reportData);
                
                if (existingReports?.length > 0) {
                    await queueSync('update_wet_sprinkler_report', { id: existingReports[0].id, updates: reportData });
                } else {
                    await queueSync('create_wet_sprinkler_report', reportData);
                }
                
                toast.success("Report saved offline - will sync when connected");
                setIsDirty(false);
            }
        } catch (error) {
            console.error("Error saving report:", error);
            toast.error(isOnline ? "Failed to save report" : "Failed to save offline");
        } finally {
            setIsSaving(false);
        }
    }

    // Print functionality
    const handlePrint = () => {
        window.print();
    };

    const { isSaving: isAutoSaving, lastSaved } = useAutoSave(reportData, handleSave, { enabled: isDirty });

    // Handle navigation
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    if (inspectionLoading) {
        return (
            <div className="p-6 text-center">
                <div className="animate-pulse text-slate-400">Loading report...</div>
            </div>
        );
    }

    if (!inspection || inspection.length === 0) {
        return (
            <div className="p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-900 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Inspection Not Found
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-red-800">
                        The inspection could not be loaded. Please go back and try again.
                    </CardContent>
                </Card>
            </div>
        );
    }

    const inspectionData = inspection[0];
    const propertyData = properties?.find(p => p.id === inspectionData?.property_id);
    const clientData = clients?.find(c => c.id === inspectionData?.client_id);

    return (
        <div className="min-h-screen p-3 sm:p-6">
            <div className="max-w-4xl mx-auto overflow-x-hidden">
                {/* Header */}
                <div className="mb-6 print:hidden space-y-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Wet Sprinkler Report</h1>
                        <AutoSaveIndicator isSaving={isAutoSaving} lastSaved={lastSaved} />
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowPreview(true)}
                                className="gap-2 flex-1"
                            >
                                <Eye className="h-4 w-4" />
                                Preview
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setTimeout(() => window.print(), 100);
                                }}
                                className="gap-2 flex-1"
                            >
                                <Printer className="h-4 w-4" />
                                Print
                            </Button>
                        </div>
                        <Button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2 bg-orange-500 hover:bg-orange-600 w-full"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? "Saving..." : "Save Report"}
                        </Button>
                    </div>
                </div>

                {/* Report content */}
                <div className="space-y-6">
                    {/* Company Header - Print Only */}
                    <div className="hidden print:block text-center mb-8">
                        <h2 className="text-2xl font-bold">NW FIRE PROTECTION</h2>
                        <p className="text-sm text-gray-600">Wet Sprinkler Inspection Report</p>
                    </div>

                    {/* Inspection Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Inspection Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4">
                            <div>
                                <Label>Client</Label>
                                <div className="font-medium">{clientData?.company_name}</div>
                            </div>
                            <div>
                                <Label>Property</Label>
                                <div className="font-medium">{propertyData?.name}</div>
                            </div>
                            <div>
                                <Label htmlFor="address">Address</Label>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Enter address"
                                />
                            </div>
                            <div>
                                <Label htmlFor="service_date">Service Date</Label>
                                <Input
                                    id="service_date"
                                    type="date"
                                    value={report.service_date}
                                    onChange={(e) => handleReportChange({ service_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="service_type">Service Type</Label>
                                <Select value={report.service_type} onValueChange={(val) => handleReportChange({ service_type: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="annual">Annual</SelectItem>
                                        <SelectItem value="5_year">5-Year</SelectItem>
                                        <SelectItem value="obstruction_test">Obstruction Test</SelectItem>
                                        <SelectItem value="pressure_test">Pressure Test</SelectItem>
                                        <SelectItem value="initial">Initial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="system_tag">System Tag</Label>
                                <Select value={report.system_tag} onValueChange={(val) => handleReportChange({ system_tag: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Green Tag">Green Tag (Pass)</SelectItem>
                                        <SelectItem value="Yellow Tag">Yellow Tag (Deficiency)</SelectItem>
                                        <SelectItem value="Red Tag">Red Tag (Out of Service)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* System Checks */}
                    <Card>
                        <CardHeader>
                            <CardTitle>System Checks</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <Label htmlFor="main_valve">Main Valve Status</Label>
                                    <Select value={report.main_valve_status} onValueChange={(val) => handleReportChange({ main_valve_status: val })}>
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
                                    <Label htmlFor="pressure">Pressure Gauge Reading (PSI)</Label>
                                    <Input
                                        id="pressure"
                                        value={report.pressure_gauge_reading}
                                        onChange={(e) => handleReportChange({ pressure_gauge_reading: e.target.value })}
                                        placeholder="e.g., 55 PSI"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <Label htmlFor="standpipe">Standpipe Condition</Label>
                                    <Select value={report.standpipe_condition} onValueChange={(val) => handleReportChange({ standpipe_condition: val })}>
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
                                    <Label htmlFor="backflow">Backflow Device Status</Label>
                                    <Select value={report.backflow_device_status} onValueChange={(val) => handleReportChange({ backflow_device_status: val })}>
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
                        </CardContent>
                    </Card>

                    {/* Tests */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tests Performed</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <Checkbox
                                        id="flow_test"
                                        checked={report.flow_test_completed}
                                        onCheckedChange={(checked) => handleReportChange({ flow_test_completed: checked })}
                                    />
                                    <Label htmlFor="flow_test" className="cursor-pointer">Flow Test Completed</Label>
                                </div>
                                {report.flow_test_completed && (
                                    <Textarea
                                        value={report.flow_test_results}
                                        onChange={(e) => handleReportChange({ flow_test_results: e.target.value })}
                                        placeholder="Flow test results..."
                                    />
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <Checkbox
                                        id="drain_test"
                                        checked={report.drain_test_completed}
                                        onCheckedChange={(checked) => handleReportChange({ drain_test_completed: checked })}
                                    />
                                    <Label htmlFor="drain_test" className="cursor-pointer">Drain Test Completed</Label>
                                </div>
                                {report.drain_test_completed && (
                                    <Textarea
                                        value={report.drain_test_results}
                                        onChange={(e) => handleReportChange({ drain_test_results: e.target.value })}
                                        placeholder="Drain test results..."
                                    />
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <Checkbox
                                        id="obstruction_test"
                                        checked={report.obstruction_test_completed}
                                        onCheckedChange={(checked) => handleReportChange({ obstruction_test_completed: checked })}
                                    />
                                    <Label htmlFor="obstruction_test" className="cursor-pointer">Obstruction Test Completed</Label>
                                </div>
                                {report.obstruction_test_completed && (
                                    <Textarea
                                        value={report.obstruction_test_results}
                                        onChange={(e) => handleReportChange({ obstruction_test_results: e.target.value })}
                                        placeholder="Obstruction test results..."
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sprinkler Heads */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Sprinkler Heads</CardTitle>
                            <Button 
                                onClick={addSprinklerHead}
                                className="bg-orange-500 hover:bg-orange-600"
                                size="sm"
                            >
                                Add Head
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {report.sprinkler_heads.map((head, index) => (
                                <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <Label>Location</Label>
                                            <Input
                                                value={head.location}
                                                onChange={(e) => updateSprinklerHead(index, { location: e.target.value })}
                                                placeholder="e.g., Hallway, Floor 2"
                                            />
                                        </div>
                                        <div>
                                            <Label>Condition</Label>
                                            <Select value={head.condition} onValueChange={(val) => updateSprinklerHead(index, { condition: val })}>
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
                                            <Label>&nbsp;</Label>
                                            <Button
                                                onClick={() => removeSprinklerHead(index)}
                                                variant="destructive"
                                                size="sm"
                                                className="w-full"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Textarea
                                            value={head.notes}
                                            onChange={(e) => updateSprinklerHead(index, { notes: e.target.value })}
                                            placeholder="Additional notes..."
                                            className="h-20"
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Deficiencies */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Deficiencies & Follow-up</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="deficiencies">Deficiencies Found</Label>
                                <Textarea
                                    id="deficiencies"
                                    value={report.deficiencies}
                                    onChange={(e) => handleReportChange({ deficiencies: e.target.value })}
                                    placeholder="List any deficiencies found during inspection..."
                                    className="h-24"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="follow_up"
                                    checked={report.follow_up_required}
                                    onCheckedChange={(checked) => handleReportChange({ follow_up_required: checked })}
                                />
                                <Label htmlFor="follow_up" className="cursor-pointer">Follow-up Required</Label>
                            </div>

                            {report.follow_up_required && (
                                <div>
                                    <Label htmlFor="follow_up_notes">Follow-up Notes</Label>
                                    <Textarea
                                        id="follow_up_notes"
                                        value={report.follow_up_notes}
                                        onChange={(e) => handleReportChange({ follow_up_notes: e.target.value })}
                                        placeholder="Follow-up instructions..."
                                        className="h-20"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* General Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={report.notes}
                                onChange={(e) => handleReportChange({ notes: e.target.value })}
                                placeholder="Additional notes..."
                                className="h-24"
                            />
                        </CardContent>
                    </Card>

                    {/* Technician Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Technician Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <Label htmlFor="tech_name">Name</Label>
                                    <Input
                                        id="tech_name"
                                        value={report.technician_name}
                                        onChange={(e) => handleReportChange({ technician_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="tech_license">License #</Label>
                                    <Input
                                        id="tech_license"
                                        value={report.technician_license}
                                        onChange={(e) => handleReportChange({ technician_license: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-2 block">Technician Signature</Label>
                                <SignaturePad
                                    label="Technician Signature"
                                    value={report.technician_signature_url}
                                    onChange={(dataUrl) => handleReportChange({ technician_signature_url: dataUrl })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Acknowledgment</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="cust_name">Customer Name</Label>
                                <Input
                                    id="cust_name"
                                    value={report.customer_name}
                                    onChange={(e) => handleReportChange({ customer_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="mb-2 block">Customer Signature</Label>
                                <SignaturePad
                                    label="Customer Signature"
                                    value={report.customer_signature_url}
                                    onChange={(dataUrl) => handleReportChange({ customer_signature_url: dataUrl })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button - Bottom */}
                    <Button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full gap-2 bg-orange-500 hover:bg-orange-600 print:hidden"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? "Saving..." : "Save Report"}
                    </Button>
                </div>

                {/* Print View */}
                <div className="hidden print:block">
                    {/* Logo and Company Info */}
                    <div className="text-center mb-2">
                        <img 
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png" 
                            alt="NW Fire & Safety"
                            className="print-logo"
                            style={{height: "90px", width: "auto", margin: "0 auto 0.1in auto", display: "block"}}
                        />
                        <div style={{fontSize: "7pt", lineHeight: "1.2", marginBottom: "0.05in"}}>
                            <div style={{fontWeight: "bold"}}>Northwest Fire & Safety, LLC</div>
                            <div>580-540-3119 | 2517 N Van Buren - Enid, OK 73703</div>
                            <div>OK #AC441117, #466</div>
                        </div>
                        <h2 style={{fontSize: "11pt", fontWeight: "bold", marginBottom: "0.1in"}}>WET SPRINKLER SYSTEM REPORT</h2>
                    </div>

                    <div className="space-y-4 text-sm">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 gap-4 border-b pb-4">
                            <div>
                                <div className="font-bold">Client:</div>
                                <div>{clientData?.company_name}</div>
                            </div>
                            <div>
                                <div className="font-bold">Service Date:</div>
                                <div>{report.service_date}</div>
                            </div>
                            <div>
                                <div className="font-bold">Property:</div>
                                <div>{propertyData?.name}</div>
                            </div>
                            <div>
                                <div className="font-bold">Service Type:</div>
                                <div>{report.service_type}</div>
                            </div>
                            <div className="col-span-2">
                                <div className="font-bold">Address:</div>
                                <div>{address}</div>
                            </div>
                        </div>

                        {/* System Status */}
                        <div className="border-b pb-4">
                            <div className="font-bold mb-2">System Status: {report.system_tag}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>Main Valve: {report.main_valve_status}</div>
                                <div>Pressure: {report.pressure_gauge_reading || "N/A"} PSI</div>
                                <div>Standpipe: {report.standpipe_condition}</div>
                                <div>Backflow Device: {report.backflow_device_status}</div>
                            </div>
                        </div>

                        {/* Sprinkler Heads */}
                        {report.sprinkler_heads.length > 0 && (
                            <div className="border-b pb-4">
                                <div className="font-bold mb-2">Sprinkler Heads</div>
                                {report.sprinkler_heads.map((head, idx) => (
                                    <div key={idx} className="text-xs mb-1">
                                        <strong>{head.location}</strong> - {head.condition}
                                        {head.notes && <div className="ml-2 text-gray-600">{head.notes}</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tests */}
                        {(report.flow_test_completed || report.drain_test_completed || report.obstruction_test_completed) && (
                            <div className="border-b pb-4">
                                <div className="font-bold mb-2">Tests Performed</div>
                                {report.flow_test_completed && <div className="text-xs">Flow Test: {report.flow_test_results}</div>}
                                {report.drain_test_completed && <div className="text-xs">Drain Test: {report.drain_test_results}</div>}
                                {report.obstruction_test_completed && <div className="text-xs">Obstruction Test: {report.obstruction_test_results}</div>}
                            </div>
                        )}

                        {/* Deficiencies */}
                        {report.deficiencies && (
                            <div className="border-b pb-4">
                                <div className="font-bold mb-2">Deficiencies</div>
                                <div className="text-xs whitespace-pre-wrap">{report.deficiencies}</div>
                            </div>
                        )}

                        {/* Notes */}
                        {report.notes && (
                            <div className="border-b pb-4">
                                <div className="font-bold mb-2">Notes</div>
                                <div className="text-xs whitespace-pre-wrap">{report.notes}</div>
                            </div>
                        )}

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-8 pt-8">
                            <div>
                                <div className="text-xs font-bold mb-12">Technician</div>
                                <div className="border-t border-black pt-2 text-xs">{report.technician_name}</div>
                                {report.technician_license && <div className="text-xs text-gray-600">Lic: {report.technician_license}</div>}
                            </div>
                            <div>
                                <div className="text-xs font-bold mb-12">Customer</div>
                                <div className="border-t border-black pt-2 text-xs">{report.customer_name}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Dialog */}
                <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle>Report Preview</DialogTitle>
                        </DialogHeader>
                        <div className="bg-white p-8">
                            {/* Logo */}
                            <div className="flex justify-center mb-3">
                                <img 
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/ab5e51f05_LOGO-2024-BlackSurround.jpg" 
                                    alt="NW Fire & Safety" 
                                    style={{height: "0.8in", width: "auto"}}
                                />
                            </div>

                            <div className="text-center mb-2 text-xs">
                                <div>Northwest Fire & Safety, LLC</div>
                                <div>580-540-3119 | 2517 N Van Buren - Enid, OK 73703</div>
                                <div>OK #AC441117, #466</div>
                            </div>

                            <div className="text-center mb-4">
                                <h2 className="text-lg font-bold">WET SPRINKLER SYSTEM INSPECTION REPORT</h2>
                                <p className="text-xs text-gray-600 mt-1">NFPA 25 Compliance</p>
                            </div>

                            <div className="space-y-4 text-sm">
                                {/* Header Info */}
                                <div className="grid grid-cols-2 gap-4 border-b pb-4">
                                    <div>
                                        <div className="font-bold">Client:</div>
                                        <div>{clientData?.company_name}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold">Service Date:</div>
                                        <div>{report.service_date}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold">Property:</div>
                                        <div>{propertyData?.name}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold">Service Type:</div>
                                        <div>{report.service_type}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="font-bold">Address:</div>
                                        <div>{address}</div>
                                    </div>
                                </div>

                                {/* System Status */}
                                <div className="border-b pb-4">
                                    <div className="font-bold mb-2">System Status: {report.system_tag}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>Main Valve: {report.main_valve_status}</div>
                                        <div>Pressure: {report.pressure_gauge_reading || "N/A"} PSI</div>
                                        <div>Standpipe: {report.standpipe_condition}</div>
                                        <div>Backflow Device: {report.backflow_device_status}</div>
                                    </div>
                                </div>

                                {/* Sprinkler Heads */}
                                {report.sprinkler_heads.length > 0 && (
                                    <div className="border-b pb-4">
                                        <div className="font-bold mb-2">Sprinkler Heads</div>
                                        {report.sprinkler_heads.map((head, idx) => (
                                            <div key={idx} className="text-xs mb-1">
                                                <strong>{head.location}</strong> - {head.condition}
                                                {head.notes && <div className="ml-2 text-gray-600">{head.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Tests */}
                                {(report.flow_test_completed || report.drain_test_completed || report.obstruction_test_completed) && (
                                    <div className="border-b pb-4">
                                        <div className="font-bold mb-2">Tests Performed</div>
                                        {report.flow_test_completed && <div className="text-xs">Flow Test: {report.flow_test_results}</div>}
                                        {report.drain_test_completed && <div className="text-xs">Drain Test: {report.drain_test_results}</div>}
                                        {report.obstruction_test_completed && <div className="text-xs">Obstruction Test: {report.obstruction_test_results}</div>}
                                    </div>
                                )}

                                {/* Deficiencies */}
                                {report.deficiencies && (
                                    <div className="border-b pb-4">
                                        <div className="font-bold mb-2">Deficiencies</div>
                                        <div className="text-xs whitespace-pre-wrap">{report.deficiencies}</div>
                                    </div>
                                )}

                                {/* Notes */}
                                {report.notes && (
                                    <div className="border-b pb-4">
                                        <div className="font-bold mb-2">Notes</div>
                                        <div className="text-xs whitespace-pre-wrap">{report.notes}</div>
                                    </div>
                                )}

                                {/* Signatures */}
                                <div className="grid grid-cols-2 gap-8 pt-8">
                                    <div>
                                        <div className="text-xs font-bold mb-2">Technician</div>
                                        {report.technician_signature_url && (
                                            <img src={report.technician_signature_url} alt="Technician signature" className="max-h-16 mb-2" />
                                        )}
                                        <div className="border-t border-black pt-2 text-xs">{report.technician_name}</div>
                                        {report.technician_license && <div className="text-xs text-gray-600">Lic: {report.technician_license}</div>}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold mb-2">Customer</div>
                                        {report.customer_signature_url && (
                                            <img src={report.customer_signature_url} alt="Customer signature" className="max-h-16 mb-2" />
                                        )}
                                        <div className="border-t border-black pt-2 text-xs">{report.customer_name}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Save Alert */}
                <AlertDialog open={showSaveAlert} onOpenChange={setShowSaveAlert}>
                    <AlertDialogContent>
                        <AlertDialogTitle>Report Saved</AlertDialogTitle>
                        <AlertDialogDescription>
                            The wet sprinkler report has been saved successfully.
                        </AlertDialogDescription>
                        <AlertDialogAction onClick={() => setShowSaveAlert(false)}>
                            OK
                        </AlertDialogAction>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Exit Alert */}
                <AlertDialog open={showExitAlert} onOpenChange={setShowExitAlert}>
                    <AlertDialogContent>
                        <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Are you sure you want to leave?
                        </AlertDialogDescription>
                        <div className="flex gap-3 justify-end">
                            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                            <AlertDialogAction onClick={() => window.history.back()}>
                                Leave Without Saving
                            </AlertDialogAction>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <style>{`
                @media print {
                    @page { margin: 0.25in; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { margin: 0; padding: 0; line-height: 1.1; font-size: 7pt; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .print\\:hidden { display: none !important; }
                    img { display: block !important; max-width: 100% !important; }
                    .max-w-4xl { max-width: 100%; margin: 0; padding: 0; }
                    .px-4, .px-6, .px-8, .py-8 { padding: 0 !important; }
                    .mb-6, .mb-4, .mb-3, .mb-2, .mb-1 { margin-bottom: 0.03in !important; }
                    .space-y-6 > * + *, .space-y-4 > * + *, .space-y-3 > * + * { margin-top: 0 !important; }
                    .h-20, .h-16, .h-10 { height: 0.6in !important; }
                    .rounded-2xl, .rounded-xl, .rounded-lg { border-radius: 0 !important; }
                    .shadow-lg, .shadow-sm, .shadow { box-shadow: none !important; border: none !important; }
                    .border { border: none !important; }
                    .text-xl, .text-lg { font-size: 9pt !important; font-weight: bold; }
                    .text-base { font-size: 7pt !important; }
                    .text-sm { font-size: 6.5pt !important; }
                    .text-xs { font-size: 6pt !important; }
                    .bg-gradient-to-r, .bg-orange-500 { background: none !important; }
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
        </div>
    );
}