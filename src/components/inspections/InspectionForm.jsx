import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Bell, Droplets, Flame, Lightbulb, DoorClosed, ChefHat, Activity, ClipboardCheck, FileText, Upload, X, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const inspectionTypes = [
    { value: "annual", label: "Annual" },
    { value: "semi_annual", label: "Semi-Annual" },
    { value: "quarterly", label: "Quarterly" },
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
    { value: "initial", label: "Initial" },
    { value: "followup", label: "Follow-up" },
    { value: "call_in", label: "Call-In" },
    { value: "emergency", label: "Emergency" }
];

const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "to_be_completed", label: "To Be Completed" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "requires_followup", label: "Requires Follow-up" },
    { value: "invoiced", label: "Invoiced" }
];

const reportTypes = [
    { value: "fire_alarm", label: "Fire Alarm System", icon: Bell, color: "bg-[#FF000D]" },
    { value: "sprinkler_system", label: "Sprinkler System", icon: Droplets, color: "bg-[#B0E0E6]" },
    { value: "fire_extinguisher", label: "Fire Extinguisher", icon: Flame, color: "bg-[#FF7F00]" },
    { value: "emergency_lighting", label: "Emergency Lighting", icon: Lightbulb, color: "bg-[#DDB022]" },
    { value: "kitchen_suppression", label: "Kitchen Suppression", icon: ChefHat, color: "bg-blue-500" },
    { value: "fire_pump", label: "Fire Pump", icon: Activity, color: "bg-teal-500" },
    { value: "work_order", label: "Work Order", icon: ClipboardCheck, color: "bg-slate-500" },
    { value: "pdf_upload", label: "PDF Upload", icon: FileText, color: "bg-slate-500" }
];

export default function InspectionForm({ open, onClose, inspection, clients, properties, onSave, isSaving, isAdmin }) {
    const [formData, setFormData] = useState({
       client_id: "",
       property_id: "",
       property_name: "",
       inspector_id: "",
       inspector_name: "",
       inspector_license: "",
       scheduled_date: "",
       scheduled_day: "",
       scheduled_time: "",
       inspection_type: "annual",
       report_types: [],
       status: "to_be_completed",
       notes: "",
       is_recurring: true,
       is_priority: false
       });

    const [clientSearch, setClientSearch] = useState("");
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfFileName, setPdfFileName] = useState("");

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list(),
    });

    const { data: userProfiles = [] } = useQuery({
        queryKey: ['userProfiles'],
        queryFn: () => base44.entities.UserProfile.list(),
    });

    // Filter users to only include active technicians with 'user' role
    const inspectors = users
        .filter(user => {
            const profile = userProfiles.find(p => p.user_id === user.id);
            return profile && profile.role === 'user' && profile.status !== 'disabled';
        })
        .map(user => {
            const profile = userProfiles.find(p => p.user_id === user.id);
            return {
                id: user.id,
                name: profile?.display_name || user.full_name || user.email,
                email: user.email
            };
        });

    useEffect(() => {
       if (inspection) {
           const date = inspection.scheduled_date || "";
           const isMonthOnly = date && date.length === 7; // YYYY-MM format
           setFormData({
               client_id: inspection.client_id || "",
               property_id: inspection.property_id || "",
               property_name: inspection.property_name || "",
               inspector_id: inspection.inspector_id || "",
               inspector_name: inspection.inspector_name || "",
               inspector_license: inspection.inspector_license || "",
               scheduled_date: isMonthOnly ? date : (date ? date.substring(0, 7) : ""),
               scheduled_day: isMonthOnly ? "" : (date ? date.substring(8, 10) : ""),
               scheduled_time: inspection.scheduled_time || "",
               inspection_type: inspection.inspection_type || "annual",
               report_types: inspection.report_types || [],
               status: inspection.status || "to_be_completed",
               notes: inspection.notes || "",
               is_recurring: inspection.is_recurring !== undefined ? inspection.is_recurring : true,
               is_priority: inspection.is_priority || false
           });
       } else {
           setFormData({
               client_id: "",
               property_id: "",
               property_name: "",
               inspector_id: "",
               inspector_name: "",
               inspector_license: "",
               scheduled_date: "",
               scheduled_day: "",
               scheduled_time: "",
               inspection_type: "annual",
               report_types: [],
               status: "to_be_completed",
               notes: "",
               is_recurring: true,
               is_priority: false
               });
       }
    }, [inspection, open]);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setPdfFileName(file.name);
        }
    };

    const handleRemoveFile = () => {
        setPdfFile(null);
        setPdfFileName("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let finalFormData = { ...formData };
        
        // Combine month and day into scheduled_date
        if (finalFormData.scheduled_date) {
            if (finalFormData.scheduled_day) {
                finalFormData.scheduled_date = `${finalFormData.scheduled_date}-${finalFormData.scheduled_day.padStart(2, '0')}`;
            }
            // If no day, keep as YYYY-MM format
        }
        delete finalFormData.scheduled_day;

        // Upload PDF if attached
        if (pdfFile) {
            try {
                const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });
                finalFormData.notes = finalFormData.notes + (finalFormData.notes ? "\n\n" : "") + `Attached PDF: ${file_url}`;
            } catch (error) {
                return;
            }
        }
        
        onSave(finalFormData);
    };

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl">
                        {inspection ? "Edit Inspection" : "Schedule New Inspection"}
                    </SheetTitle>
                    <SheetDescription>
                        {inspection ? "Update inspection details" : "Enter the details for the new inspection"}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="client_id">Client *</Label>
                        <Select
                            value={formData.client_id}
                            onValueChange={(value) => {
                                setFormData({...formData, client_id: value});
                                setClientSearch("");
                            }}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                                <div className="px-2 pb-2">
                                    <Input
                                        placeholder="Search clients..."
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        className="h-8"
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                                {clients
                                    ?.filter(client => 
                                        client.company_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                        client.contact_name?.toLowerCase().includes(clientSearch.toLowerCase())
                                    )
                                    .map(client => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.company_name}
                                        </SelectItem>
                                    ))
                                }
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="property_name">Property Name & Address</Label>
                        <Textarea
                            id="property_name"
                            value={formData.property_name}
                            onChange={(e) => setFormData({...formData, property_name: e.target.value})}
                            placeholder="Main Office Building, 123 Main St, City, State ZIP"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inspection_type">Inspection Frequency</Label>
                        <Select
                            value={formData.inspection_type}
                            onValueChange={(value) => setFormData({...formData, inspection_type: value})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {inspectionTypes.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <Checkbox
                            id="is_recurring"
                            checked={formData.is_recurring}
                            onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked})}
                        />
                        <label htmlFor="is_recurring" className="text-sm font-medium cursor-pointer">
                            Recurring Inspection (automatically schedules next inspection when completed)
                        </label>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center space-x-2 p-4 bg-pink-50 rounded-lg border border-pink-200">
                            <Checkbox
                                id="is_priority"
                                checked={formData.is_priority}
                                onCheckedChange={(checked) => setFormData({...formData, is_priority: checked})}
                            />
                            <label htmlFor="is_priority" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-pink-600" />
                                Mark as Priority (one-time, does not recur)
                            </label>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="report_types">Report Types *</Label>
                        <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                            {reportTypes.map(type => {
                                const Icon = type.icon;
                                const isChecked = formData.report_types.includes(type.value);
                                return (
                                    <div key={type.value} className="flex items-center gap-3">
                                        <Checkbox
                                            id={`report-${type.value}`}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setFormData({
                                                        ...formData,
                                                        report_types: [...formData.report_types, type.value]
                                                    });
                                                } else {
                                                    setFormData({
                                                        ...formData,
                                                        report_types: formData.report_types.filter(t => t !== type.value)
                                                    });
                                                }
                                            }}
                                        />
                                        <label 
                                            htmlFor={`report-${type.value}`}
                                            className="flex items-center gap-2 cursor-pointer flex-1"
                                        >
                                            <div className={`p-1.5 rounded ${type.color}`}>
                                                <Icon className="h-4 w-4 text-white" />
                                            </div>
                                            <span className="text-sm font-medium">{type.label}</span>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2 w-full mb-4 sm:mb-0">
                            <Label htmlFor="scheduled_date" className="block mb-2">Month *</Label>
                            <Input
                                id="scheduled_date"
                                type="month"
                                value={formData.scheduled_date}
                                onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                                required
                                className="w-full min-h-[48px]"
                            />
                        </div>
                        <div className="space-y-2 w-full">
                            <Label htmlFor="scheduled_day" className="block mb-2">Day (Optional)</Label>
                            <Input
                                id="scheduled_day"
                                type="number"
                                min="1"
                                max="31"
                                placeholder="Day"
                                value={formData.scheduled_day}
                                onChange={(e) => setFormData({...formData, scheduled_day: e.target.value})}
                                className="w-full min-h-[48px]"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                         <Label htmlFor="inspector_name">Inspector Name</Label>
                         <Select
                             value={formData.inspector_id}
                             onValueChange={(value) => {
                                 const inspector = inspectors.find(i => i.id === value);
                                 setFormData({
                                     ...formData, 
                                     inspector_id: value,
                                     inspector_name: inspector?.name || ""
                                 });
                             }}
                         >
                             <SelectTrigger>
                                 <SelectValue placeholder="Select inspector" />
                             </SelectTrigger>
                             <SelectContent position="popper" sideOffset={5} className="max-h-[200px]">
                                 {inspectors.map(inspector => (
                                     <SelectItem key={inspector.id} value={inspector.id}>
                                         {inspector.name}
                                     </SelectItem>
                                 ))}
                             </SelectContent>
                         </Select>
                      </div>

                    <div className="space-y-2">
                        <Label htmlFor="inspector_license">Inspector License #</Label>
                        <Input
                            id="inspector_license"
                            value={formData.inspector_license}
                            onChange={(e) => setFormData({...formData, inspector_license: e.target.value})}
                            placeholder="Enter license number"
                        />
                    </div>

                    {inspection && (
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) => setFormData({...formData, status: value})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map(status => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                         <Label htmlFor="notes">Notes</Label>
                         <Textarea
                             id="notes"
                             value={formData.notes}
                             onChange={(e) => setFormData({...formData, notes: e.target.value})}
                             onKeyDown={(e) => {
                                 if (e.key === ' ') {
                                     e.stopPropagation();
                                 }
                             }}
                             placeholder="Additional notes about this inspection..."
                             rows={3}
                         />
                         <div className="mt-3">
                             {pdfFileName ? (
                                 <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                     <div className="flex items-center gap-2">
                                         <FileText className="h-4 w-4 text-emerald-600" />
                                         <span className="text-sm text-emerald-700">{pdfFileName}</span>
                                     </div>
                                     <Button
                                         type="button"
                                         variant="ghost"
                                         size="icon"
                                         onClick={handleRemoveFile}
                                         className="h-6 w-6 text-emerald-600 hover:bg-emerald-100"
                                     >
                                         <X className="h-4 w-4" />
                                     </Button>
                                 </div>
                             ) : (
                                 <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
                                     <Upload className="h-4 w-4 text-slate-500" />
                                     <span className="text-sm text-slate-600">Attach PDF</span>
                                     <input
                                         type="file"
                                         accept=".pdf"
                                         onChange={handleFileChange}
                                         className="hidden"
                                     />
                                 </label>
                             )}
                         </div>
                     </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="w-full sm:flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 whitespace-nowrap"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {inspection ? "Update" : "Schedule"} Inspection
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}