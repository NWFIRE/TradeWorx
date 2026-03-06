import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { ArrowLeft, Save, Printer, Loader2, Eye, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SignaturePad from "@/components/inspections/SignaturePad";
import { format } from "date-fns";
import { useAutoSave } from "../components/reports/useAutoSave";
import AutoSaveIndicator from "../components/reports/AutoSaveIndicator";

export default function WorkOrderReport() {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get('inspection_id');
    const queryClient = useQueryClient();

    const [workOrder, setWorkOrder] = useState({
        job_date: format(new Date(), "yyyy-MM-dd"),
        technician_name: "",
        description_of_work: "",
        job_notes: "",
        follow_up_required: false,
        customer_name: "",
        customer_print_name: "",
        jobsite_hours: ""
    });

    const [serviceProvided, setServiceProvided] = useState([]);
    const [customServices, setCustomServices] = useState({});

    const [signatures, setSignatures] = useState({
        customer: null,
        technician: null
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [parts, setParts] = useState([]);

    const { data: inspection } = useQuery({
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

    const { data: userProfiles = [] } = useQuery({
        queryKey: ['userProfiles'],
        queryFn: async () => {
            const profiles = await base44.entities.UserProfile.list();
            return profiles.filter(p => p.status === 'active');
        },
    });

    const { data: workOrderParts = [] } = useQuery({
        queryKey: ['workOrderParts', inspectionId],
        queryFn: () => base44.entities.WorkOrderPart.filter({ inspection_id: inspectionId }),
        enabled: !!inspectionId,
    });

    const currentInspection = inspection?.[0];
    const property = properties.find(p => p.id === currentInspection?.property_id);
    const client = clients.find(c => c.id === currentInspection?.client_id);

    useEffect(() => {
        if (currentInspection) {
            // Load existing work order data from inspection notes if available
            let existingData = null;
            try {
                if (currentInspection.notes) {
                    existingData = JSON.parse(currentInspection.notes);
                }
            } catch (e) {
                console.error("Failed to parse work order data:", e);
            }

            const technicianName = currentInspection.inspector_name || "";
            const customerName = client?.company_name || "";

            setWorkOrder({
                job_date: existingData?.job_date || format(new Date(), "yyyy-MM-dd"),
                technician_name: existingData?.technician_name || technicianName,
                customer_name: existingData?.customer_name || customerName,
                description_of_work: existingData?.description_of_work || existingData?.service_performed || "",
                job_notes: existingData?.job_notes || "",
                follow_up_required: existingData?.follow_up_required || false,
                customer_print_name: existingData?.customer_print_name || "",
                jobsite_hours: existingData?.jobsite_hours || ""
            });

            // Load existing service_provided
            if (existingData?.service_provided && Array.isArray(existingData.service_provided)) {
                setServiceProvided(existingData.service_provided.map(s => ({
                    service_type: s.service_type || '',
                    quantity: s.quantity || 1
                })));
                const loadedCustomServices = {};
                existingData.service_provided.forEach((s, idx) => {
                    if (s.service_type === 'custom' && s.custom_service) {
                        loadedCustomServices[idx] = s.custom_service;
                    }
                });
                setCustomServices(loadedCustomServices);
            }

            // Load existing signature
            if (existingData?.customer_signature) {
                setSignatures(prev => ({
                    ...prev,
                    customer: existingData.customer_signature
                }));
            }
        }
    }, [currentInspection, client]);

    useEffect(() => {
        if (workOrderParts.length > 0) {
            setParts(workOrderParts.map(p => ({
                id: p.id,
                part_name: p.part_name || '',
                custom_part_name: p.custom_part_name || '',
                quantity: p.quantity || 1
            })));
        }
    }, [workOrderParts]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (!inspectionId) throw new Error("No inspection ID");
            
            // Store all work order data as JSON in inspection notes
              const workOrderData = {
                   job_date: workOrder.job_date,
                   customer_name: data.customer_name,
                   customer_print_name: data.customer_print_name,
                   description_of_work: data.description_of_work,
                   job_notes: data.job_notes,
                   follow_up_required: data.follow_up_required,
                   jobsite_hours: data.jobsite_hours,
                   technician_name: data.technician_name,
                   customer_signature: data.customerSignature,
                   parts: parts.map(p => ({
                       part_name: p.part_name,
                       custom_part_name: p.custom_part_name,
                       quantity: p.quantity
                   })),
                   service_provided: serviceProvided.map(s => ({
                       service_type: s.service_type,
                       custom_service: customServices[serviceProvided.indexOf(s)] || '',
                       quantity: s.quantity
                   }))
               };
            
            const updateData = {
                status: "completed",
                notes: JSON.stringify(workOrderData)
            };
            
            if (data.customerSignature) {
                updateData.signature_url = data.customerSignature;
            }
            
            console.log("Saving inspection with data:", updateData);
            const result = await base44.entities.Inspection.update(inspectionId, updateData);
            console.log("Save result:", result);
            return result;
        },
        onSuccess: (data) => {
            console.log("Save successful:", data);
            queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
            toast.success("Work Order saved successfully");
            setIsSaving(false);
        },
        onError: (error) => {
            console.error("Save error:", error);
            toast.error("Failed to save work order: " + error.message);
            setIsSaving(false);
        }
    });

    const handleSave = async (isAutoSave = false) => {
        console.log("handleSave called with workOrder:", workOrder, "isAutoSave:", isAutoSave);

        // Only validate on manual save
        if (!isAutoSave && (!workOrder.technician_name || !workOrder.description_of_work)) {
            toast.error("Please fill in technician name and description of work");
            return;
        }

        if (!inspectionId) {
            console.error("No inspection ID found");
            if (!isAutoSave) toast.error("No inspection found");
            return;
        }

        console.log("Starting save with inspection ID:", inspectionId);
        if (!isAutoSave) setIsSaving(true);
        
        // Save parts
        try {
            // Delete existing parts
            for (const existingPart of workOrderParts) {
                await base44.entities.WorkOrderPart.delete(existingPart.id);
            }
            
            // Create new parts
            for (const part of parts) {
                if (part.part_name || part.custom_part_name) {
                    await base44.entities.WorkOrderPart.create({
                        inspection_id: inspectionId,
                        part_name: part.part_name,
                        custom_part_name: part.custom_part_name,
                        quantity: part.quantity
                    });
                }
            }
            
            queryClient.invalidateQueries({ queryKey: ['workOrderParts', inspectionId] });
        } catch (error) {
            console.error("Error saving parts:", error);
            if (!isAutoSave) toast.error("Failed to save parts");
        }

        const saveData = {
            customer_name: workOrder.customer_name,
            customer_print_name: workOrder.customer_print_name,
            description_of_work: workOrder.description_of_work,
            job_notes: workOrder.job_notes,
            follow_up_required: workOrder.follow_up_required,
            jobsite_hours: workOrder.jobsite_hours,
            technician_name: workOrder.technician_name,
            customerSignature: signatures.customer
        };

        console.log("Save data:", saveData);
        saveMutation.mutate(saveData, {
            onError: () => {
                if (!isAutoSave) {
                    setIsSaving(false);
                }
            }
        });
    };

    // Create a combined state object for auto-save to watch all changes
         const combinedState = { workOrder, serviceProvided, customServices, parts, signatures };
         const { isSaving: isAutoSaving, lastSaved } = useAutoSave(
             combinedState, 
             () => handleSave(true),  // Pass true for auto-save mode
             { enabled: true, delay: 8000 }
         );

    const handlePrint = async () => {
        // Save first
        await handleSave();
        
        setIsGenerating(true);
        try {
            toast.info("Generating report...");
            const response = await base44.functions.invoke('generateWorkOrderReport', { 
                inspection_id: inspectionId 
            });

            if (response.data?.html_content) {
                const blob = new Blob([response.data.html_content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const newWindow = window.open(url, '_blank');
                
                if (newWindow) {
                    toast.success("Report opened in new tab");
                    setTimeout(() => {
                        newWindow.print();
                    }, 500);
                    newWindow.addEventListener('afterprint', () => {
                        newWindow.close();
                    });
                } else {
                    toast.error("Pop-up blocked - please allow pop-ups to view the report");
                }
            } else {
                toast.error(response.data?.error || "Failed to generate report");
            }
        } catch (error) {
            console.error("Print error:", error);
            toast.error(error.response?.data?.error || error.message || "Error generating report");
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePreview = async () => {
        setIsGenerating(true);
        try {
            const response = await base44.functions.invoke('generateWorkOrderReport', { 
                inspection_id: inspectionId 
            });

            if (response.data?.html_content) {
                const blob = new Blob([response.data.html_content], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                toast.success("Report preview opened");
            } else {
                toast.error(response.data?.error || "Failed to generate preview");
            }
        } catch (error) {
            console.error("Preview error:", error);
            toast.error("Failed to generate preview");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSignatureCapture = (type, signatureUrl) => {
        setSignatures(prev => ({
            ...prev,
            [type]: signatureUrl
        }));
    };

    return (
         <div className="min-h-screen bg-white print:bg-white">
              <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8 print:p-0">
                 {/* Logo */}
                 <div className="flex justify-center mb-3 print:hidden">
                     <img 
                         src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/ab5e51f05_LOGO-2024-BlackSurround.jpg" 
                         alt="NW Fire & Safety" 
                         className="h-16"
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

                 {/* Header */}
                 <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                     <Link to={createPageUrl("Inspections")}>
                         <Button variant="ghost" size="icon" className="h-9 w-9">
                             <ArrowLeft className="h-5 w-5" />
                         </Button>
                     </Link>
                     <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex-1 no-print">Work Order Report</h1>
                     <AutoSaveIndicator isSaving={isAutoSaving} lastSaved={lastSaved} />
                     <div className="flex gap-2 w-full sm:w-auto no-print">
                         <Button 
                             variant="outline" 
                             onClick={handlePreview}
                             disabled={isGenerating}
                             className="gap-2 flex-1 sm:flex-none h-10"
                         >
                             {isGenerating ? (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                             ) : (
                                 <Eye className="h-4 w-4 hidden sm:block" />
                             )}
                             <span className="sm:hidden">Preview</span>
                         </Button>
                         <Button 
                             variant="outline" 
                             onClick={handlePrint}
                             disabled={isGenerating}
                             className="gap-2 flex-1 sm:flex-none h-10"
                         >
                             {isGenerating ? (
                                 <Loader2 className="h-4 w-4 animate-spin" />
                             ) : (
                                 <Printer className="h-4 w-4 hidden sm:block" />
                             )}
                             <span className="sm:hidden">Print</span>
                         </Button>
                         <Button 
                             onClick={handleSave}
                             disabled={isSaving}
                             className="gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 flex-1 sm:flex-none h-10 no-print relative overflow-hidden"
                         >
                             {isSaving && (
                                 <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 animate-pulse" />
                             )}
                             <span className="relative z-10 flex items-center gap-2">
                                 {isSaving ? (
                                     <>
                                         <Loader2 className="h-4 w-4 animate-spin" />
                                         <span className="hidden sm:inline">Saving...</span>
                                     </>
                                 ) : (
                                     <>
                                         <Save className="h-4 w-4 hidden sm:block" />
                                         <span className="sm:hidden">Save</span>
                                     </>
                                 )}
                             </span>
                         </Button>
                     </div>
                 </div>

                {/* Work Order Content */}
                <div className="space-y-4 sm:space-y-6 print:hidden no-print">
                    {/* Basic Info */}
                     <Card className="print:hidden">
                         <CardHeader className="p-3 sm:p-6">
                             <CardTitle className="text-lg">Job Information</CardTitle>
                         </CardHeader>
                        <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                                <div>
                                    <Label>Job Date</Label>
                                    <Input 
                                        type="date"
                                        value={workOrder.job_date}
                                        onChange={(e) => setWorkOrder({...workOrder, job_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>Customer Name</Label>
                                    <Combobox
                                        value={workOrder.customer_name}
                                        onValueChange={(value) => setWorkOrder({...workOrder, customer_name: value})}
                                        options={clients.map(c => ({ value: c.company_name, label: c.company_name }))}
                                        placeholder="Select customer"
                                        searchPlaceholder="Search customers..."
                                        emptyText="No customers found."
                                    />
                                </div>
                                <div>
                                     <Label>Service Location</Label>
                                     <Input 
                                         value={property?.name || ""}
                                         disabled
                                         placeholder="Auto-filled from inspection"
                                     />
                                 </div>
                                 <div>
                                     <Label>Technician Name *</Label>
                                     <Combobox
                                         value={workOrder.technician_name}
                                         onValueChange={(value) => setWorkOrder({...workOrder, technician_name: value})}
                                         options={userProfiles.map(p => ({ value: p.display_name || p.contact_email, label: p.display_name || p.contact_email }))}
                                         placeholder="Select technician"
                                         searchPlaceholder="Search technicians..."
                                         emptyText="No technicians found."
                                     />
                                 </div>
                                 </div>
                        </CardContent>
                    </Card>

                    {/* Service Details */}
                     <Card className="print:hidden">
                         <CardHeader className="p-3 sm:p-6">
                             <CardTitle className="text-lg">Service Details</CardTitle>
                         </CardHeader>
                        <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                            <div>
                                 <Label>Description Of Work *</Label>
                                 <Textarea 
                                     value={workOrder.description_of_work}
                                     onChange={(e) => setWorkOrder({...workOrder, description_of_work: e.target.value})}
                                     placeholder="Describe the service work performed..."
                                     rows={4}
                                 />
                             </div>
                             <div>
                                 <Label>Jobsite Hours</Label>
                                 <Select
                                     value={workOrder.jobsite_hours}
                                     onValueChange={(value) => setWorkOrder({...workOrder, jobsite_hours: value})}
                                 >
                                     <SelectTrigger>
                                         <SelectValue placeholder="Select hours" />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="0.5">0.5 hours</SelectItem>
                                         <SelectItem value="1">1 hour</SelectItem>
                                         <SelectItem value="1.5">1.5 hours</SelectItem>
                                         <SelectItem value="2">2 hours</SelectItem>
                                         <SelectItem value="2.5">2.5 hours</SelectItem>
                                         <SelectItem value="3">3 hours</SelectItem>
                                         <SelectItem value="3.5">3.5 hours</SelectItem>
                                         <SelectItem value="4">4 hours</SelectItem>
                                         <SelectItem value="4.5">4.5 hours</SelectItem>
                                         <SelectItem value="5">5 hours</SelectItem>
                                         <SelectItem value="5.5">5.5 hours</SelectItem>
                                         <SelectItem value="6">6 hours</SelectItem>
                                         <SelectItem value="6.5">6.5 hours</SelectItem>
                                         <SelectItem value="7">7 hours</SelectItem>
                                         <SelectItem value="7.5">7.5 hours</SelectItem>
                                         <SelectItem value="8">8 hours</SelectItem>
                                     </SelectContent>
                                 </Select>
                             </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <Label>Parts/Equipment Used</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setParts([...parts, { part_name: '', custom_part_name: '', quantity: 1 }])}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Part
                                    </Button>
                                </div>
                                {parts.length === 0 ? (
                                    <div className="text-sm text-slate-500 text-center py-4 border border-dashed rounded-lg">
                                        No parts added yet
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {parts.map((part, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="flex-1">
                                                    <Select
                                                        value={part.part_name}
                                                        onValueChange={(value) => {
                                                            const updated = [...parts];
                                                            updated[idx].part_name = value;
                                                            updated[idx].custom_part_name = '';
                                                            setParts(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select part" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                             <SelectItem value="2.5lb ABC - New">2.5lb ABC - New</SelectItem>
                                                             <SelectItem value="5lb ABC - New">5lb ABC - New</SelectItem>
                                                             <SelectItem value="10lb ABC - New">10lb ABC - New</SelectItem>
                                                             <SelectItem value="20lb ABC - New">20lb ABC - New</SelectItem>
                                                             <SelectItem value="CO2 5lb - New">CO2 5lb - New</SelectItem>
                                                             <SelectItem value="CO2 10lb - New">CO2 10lb - New</SelectItem>
                                                             <SelectItem value="6L K-Class - New">6L K-Class - New</SelectItem>
                                                             <SelectItem value="Exit Sign - New">Exit Sign - New</SelectItem>
                                                             <SelectItem value="Emergency Light - New">Emergency Light - New</SelectItem>
                                                             <SelectItem value="Combo Light - New">Combo Light - New</SelectItem>
                                                             <SelectItem value="Pull Pin">Pull Pin</SelectItem>
                                                             <SelectItem value="Minimum Service Call">Minimum Service Call</SelectItem>
                                                             <SelectItem value="custom">Custom Part</SelectItem>
                                                         </SelectContent>
                                                    </Select>
                                                </div>
                                                {part.part_name === 'custom' && (
                                                    <div className="flex-1">
                                                        <Input
                                                            placeholder="Enter custom part name"
                                                            value={part.custom_part_name}
                                                            onChange={(e) => {
                                                                const updated = [...parts];
                                                                updated[idx].custom_part_name = e.target.value;
                                                                setParts(updated);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="w-24">
                                                    <Select
                                                        value={part.quantity.toString()}
                                                        onValueChange={(value) => {
                                                            const updated = [...parts];
                                                            updated[idx].quantity = parseInt(value);
                                                            setParts(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from({ length: 31 }, (_, i) => (
                                                                <SelectItem key={i} value={i.toString()}>
                                                                    {i}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setParts(parts.filter((_, i) => i !== idx))}
                                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <Label>Service Provided</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setServiceProvided([...serviceProvided, { service_type: '', quantity: 1 }])}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Service
                                    </Button>
                                </div>
                                {serviceProvided.length === 0 ? (
                                    <div className="text-sm text-slate-500 text-center py-4 border border-dashed rounded-lg">
                                        No services added yet
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {serviceProvided.map((service, idx) => (
                                            <div key={idx} className="flex gap-2 items-start">
                                                <div className="flex-1">
                                                    <Select
                                                        value={service.service_type}
                                                        onValueChange={(value) => {
                                                            const updated = [...serviceProvided];
                                                            updated[idx].service_type = value;
                                                            setServiceProvided(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select service" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                             <SelectItem value="2.5lb ABC - 6YR">2.5lb ABC - 6YR</SelectItem>
                                                             <SelectItem value="2.5lb ABC - Recharge">2.5lb ABC - Recharge</SelectItem>
                                                             <SelectItem value="5lb ABC - 6YR">5lb ABC - 6YR</SelectItem>
                                                             <SelectItem value="5lb ABC - Hydro">5lb ABC - Hydro</SelectItem>
                                                             <SelectItem value="5lb ABC - Recharge">5lb ABC - Recharge</SelectItem>
                                                             <SelectItem value="10lb ABC - 6YR">10lb ABC - 6YR</SelectItem>
                                                             <SelectItem value="10lb ABC - Hydro">10lb ABC - Hydro</SelectItem>
                                                             <SelectItem value="10lb ABC - Recharge">10lb ABC - Recharge</SelectItem>
                                                             <SelectItem value="20lb ABC - 6YR">20lb ABC - 6YR</SelectItem>
                                                             <SelectItem value="20lb ABC - Hydro">20lb ABC - Hydro</SelectItem>
                                                             <SelectItem value="20lb ABC - Recharge">20lb ABC - Recharge</SelectItem>
                                                             <SelectItem value="CO2 5lb - Hydro">CO2 5lb - Hydro</SelectItem>
                                                             <SelectItem value="CO2 5lb - Recharge">CO2 5lb - Recharge</SelectItem>
                                                             <SelectItem value="CO2 10lb - Hydro">CO2 10lb - Hydro</SelectItem>
                                                             <SelectItem value="CO2 10lb - Recharge">CO2 10lb - Recharge</SelectItem>
                                                             <SelectItem value="6L K-Class - Hydro">6L K-Class - Hydro</SelectItem>
                                                             <SelectItem value="6L K-Class - Recharge">6L K-Class - Recharge</SelectItem>
                                                             <SelectItem value="custom">Custom Service</SelectItem>
                                                         </SelectContent>
                                                    </Select>
                                                </div>
                                                {service.service_type === 'custom' && (
                                                    <div className="flex-1">
                                                        <Input
                                                            placeholder="Enter custom service"
                                                            value={customServices[idx] || ''}
                                                            onChange={(e) => {
                                                                setCustomServices(prev => ({
                                                                    ...prev,
                                                                    [idx]: e.target.value
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="w-24">
                                                    <Select
                                                        value={service.quantity.toString()}
                                                        onValueChange={(value) => {
                                                            const updated = [...serviceProvided];
                                                            updated[idx].quantity = parseInt(value);
                                                            setServiceProvided(updated);
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from({ length: 31 }, (_, i) => (
                                                                <SelectItem key={i} value={i.toString()}>
                                                                    {i}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setServiceProvided(serviceProvided.filter((_, i) => i !== idx))}
                                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <Label>Additional Notes</Label>
                                <Textarea 
                                    value={workOrder.job_notes}
                                    onChange={(e) => setWorkOrder({...workOrder, job_notes: e.target.value})}
                                    placeholder="Additional notes about parts or service..."
                                    rows={2}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    id="followUp"
                                    checked={workOrder.follow_up_required}
                                    onChange={(e) => setWorkOrder({...workOrder, follow_up_required: e.target.checked})}
                                />
                                <Label htmlFor="followUp" className="cursor-pointer mb-0">Follow-up required for this job</Label>
                            </div>
                        </CardContent>
                        </Card>

                        {/* Customer Print Name */}
                         <Card className="print:hidden">
                         <CardHeader className="p-3 sm:p-6">
                             <CardTitle className="text-lg">Customer Print Name</CardTitle>
                         </CardHeader>
                        <CardContent className="p-3 sm:p-6">
                            <Input 
                                value={workOrder.customer_print_name}
                                onChange={(e) => setWorkOrder({...workOrder, customer_print_name: e.target.value})}
                                placeholder="Name to print on work order"
                            />
                        </CardContent>
                        </Card>

                        {/* Signatures */}
                        <Card className="print:hidden">
                        <CardHeader className="p-3 sm:p-6">
                            <CardTitle className="text-lg">Signatures</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-6">
                            <div>
                                <Label className="mb-3 block">Customer Signature</Label>
                                <SignaturePad 
                                    value={signatures.customer}
                                    onChange={(data) => handleSignatureCapture('customer', data)}
                                    label="Sign here"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}