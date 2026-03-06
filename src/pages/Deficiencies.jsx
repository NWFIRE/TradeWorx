import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, MapPin, Calendar, ArrowRight, Building2, Plus, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import ClientDeficiencyGroupCard from "@/components/deficiencies/ClientDeficiencyGroupCard";
import DeficiencyForm from "@/components/deficiencies/DeficiencyForm";

const severityConfig = {
    low: { label: "Low", class: "bg-blue-100 text-blue-700 border-blue-200" },
    medium: { label: "Medium", class: "bg-amber-100 text-amber-700 border-amber-200" },
    high: { label: "High", class: "bg-rose-100 text-rose-700 border-rose-200" },
    critical: { label: "Critical", class: "bg-red-100 text-red-700 border-red-200" }
};

export default function Deficiencies() {
    const queryClient = useQueryClient();
    const [userProfile, setUserProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");
    const [showDeficiencyDialog, setShowDeficiencyDialog] = useState(false);
    const [editingDeficiency, setEditingDeficiency] = useState(null);
    const [deficiencyToDelete, setDeficiencyToDelete] = useState(null);

    React.useEffect(() => {
        const loadUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
                if (user) {
                    const profiles = await base44.entities.UserProfile.list();
                    const profile = profiles.find(p => p.user_id === user.id);
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error("Error loading user:", err);
            }
        };
        loadUser();
    }, []);

    const { data: deficiencies = [], isLoading: loadingDeficiencies } = useQuery({
        queryKey: ['deficiencies'],
        queryFn: () => base44.entities.Deficiency.list(),
    });

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list(),
    });

    const { data: properties = [], isLoading: loadingProperties } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: clients = [], isLoading: loadingClients } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const deleteDeficiencyMutation = useMutation({
        mutationFn: async (deficiencyId) => {
            await base44.entities.Deficiency.delete(deficiencyId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
            toast.success("Deficiency deleted successfully");
            setDeficiencyToDelete(null);
        },
        onError: () => {
            toast.error("Failed to delete deficiency");
        }
    });

    const createWorkOrderMutation = useMutation({
        mutationFn: async (deficiencies) => {
            // Ensure deficiencies is an array
            const deficiencyArray = Array.isArray(deficiencies) ? deficiencies : [deficiencies];
            const firstDeficiency = deficiencyArray[0];
            
            // Check if a follow-up inspection already exists for this property/client
            const existingFollowUps = inspections.filter(i => 
                i.inspection_type === "followup" &&
                i.property_id === firstDeficiency.property_id &&
                i.client_id === firstDeficiency.client_id &&
                i.status === "scheduled"
            );
            
            let followUpInspection;
            if (existingFollowUps.length > 0) {
                // Use existing follow-up inspection
                followUpInspection = existingFollowUps[0];
            } else {
                // Create new follow-up inspection
                const inspectionIds = deficiencyArray.map(d => d.inspection_id).filter((v, i, a) => a.indexOf(v) === i);
                followUpInspection = await base44.entities.Inspection.create({
                    property_id: firstDeficiency.property_id,
                    client_id: firstDeficiency.client_id,
                    inspector_id: firstDeficiency.assigned_to || currentUser?.id,
                    inspector_name: firstDeficiency.assigned_to_name || currentUser?.full_name,
                    scheduled_date: format(new Date(), "yyyy-MM-dd"),
                    status: "scheduled",
                    inspection_type: "followup",
                    report_types: [],
                    overall_result: "pending",
                    notes: `Follow-up for deficiency repairs (inspection_ids: ${inspectionIds.join(', ')})`
                });
            }

            // Build service_performed with all deficiencies
            const servicePerformed = deficiencyArray.map((d, index) => 
                `${index + 1}. ${d.title}\n   ${d.description}`
            ).join('\n\n');

            // Create work order linked to the follow-up inspection
            const workOrder = await base44.entities.WorkOrder.create({
                job_date: format(new Date(), "yyyy-MM-dd"),
                technician: firstDeficiency.assigned_to_name || currentUser?.full_name,
                customer_id: firstDeficiency.client_id,
                site_id: firstDeficiency.property_id,
                status: "draft",
                scope_of_work: ["deficiency_repair"],
                service_performed: `Deficiency Repairs:\n\n${servicePerformed}`,
                job_notes: `Total deficiencies to repair: ${deficiencyArray.length}`,
                follow_up_required: false
            });

            // Create work order deficiency entries for each deficiency
            for (const deficiency of deficiencyArray) {
                await base44.entities.WorkOrderDeficiency.create({
                    work_order_id: workOrder.id,
                    code_reference: deficiency.code_reference || "",
                    description: `${deficiency.title}\n${deficiency.description}\nLocation: ${deficiency.location || "N/A"}`,
                    severity: deficiency.severity === "critical" || deficiency.severity === "high" ? "life_safety" : "compliance",
                    recommended_action: "repair"
                });

                // Update deficiency with work order reference
                await base44.entities.Deficiency.update(deficiency.id, {
                    work_order_id: workOrder.id,
                    status: "in_progress"
                });
            }

            return { workOrder, followUpInspection };
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            const count = Array.isArray(variables) ? variables.length : 1;
            toast.success(`Follow-up inspection and work order created for ${count} ${count === 1 ? 'deficiency' : 'deficiencies'}`);
        },
        onError: () => {
            toast.error("Failed to create work order");
        }
    });

    // Filter deficiencies - admins see all, others see assigned or unassigned
    const userDeficiencies = deficiencies.filter(deficiency => {
        const isAdmin = userProfile?.role === "admin";
        const isAssignedToUser = deficiency.assigned_to === currentUser?.id;
        const isUnassigned = !deficiency.assigned_to;
        return isAdmin || isAssignedToUser || isUnassigned;
    });

    // Apply filters
    const filteredDeficiencies = userDeficiencies.filter(deficiency => {
        const matchesSearch = !searchQuery || 
            deficiency.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            deficiency.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            deficiency.location?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === "all" || deficiency.status === statusFilter;
        const matchesSeverity = severityFilter === "all" || deficiency.severity === severityFilter;
        
        return matchesSearch && matchesStatus && matchesSeverity;
    });

    // Group deficiencies by client
    const groupedByClient = filteredDeficiencies.reduce((acc, deficiency) => {
        const clientId = deficiency.client_id;
        if (!acc[clientId]) {
            acc[clientId] = [];
        }
        acc[clientId].push(deficiency);
        return acc;
    }, {});

    // Calculate statistics based on unique locations
    const uniqueLocations = new Set(userDeficiencies.map(d => d.location || "Unknown"));
    const totalDeficiencies = uniqueLocations.size;
    
    const openDeficienciesLocations = new Set(
        userDeficiencies
            .filter(d => d.status === "open" || d.status === "in_progress")
            .map(d => d.location || "Unknown")
    );
    const openDeficiencies = openDeficienciesLocations.size;
    
    const criticalDeficiencies = userDeficiencies.filter(d => d.severity === "critical" || d.severity === "high").length;

    const handleEditDeficiency = (deficiency) => {
        setEditingDeficiency(deficiency);
        setShowDeficiencyDialog(true);
    };

    const handleCreateWorkOrder = (deficiencies) => {
        createWorkOrderMutation.mutate(deficiencies);
    };

    const handleDeleteDeficiency = (deficiency) => {
        setDeficiencyToDelete(deficiency);
    };

    const confirmDelete = () => {
        if (deficiencyToDelete) {
            deleteDeficiencyMutation.mutate(deficiencyToDelete.id);
        }
    };

    const handleFormSuccess = () => {
        setShowDeficiencyDialog(false);
        setEditingDeficiency(null);
        queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
    };

    if (loadingDeficiencies || loadingInspections || loadingProperties || loadingClients) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <Skeleton className="h-10 w-64 mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                            <AlertTriangle className="h-8 w-8 text-rose-600" />
                            Deficiency Tracking
                        </h1>
                        <p className="text-slate-600 mt-2">
                            Manage, assign, and track deficiencies with full workflow
                        </p>
                    </div>
                    <Button 
                        onClick={() => {
                            setEditingDeficiency(null);
                            setShowDeficiencyDialog(true);
                        }}
                        className="bg-gradient-to-r from-orange-500 to-red-600"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Deficiency
                    </Button>
                </div>

                {/* Search and Filters */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search deficiencies..."
                                    className="pl-10"
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={severityFilter} onValueChange={setSeverityFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Severity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Severity</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Total Deficiencies</p>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {totalDeficiencies}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-100">
                                    <Building2 className="h-6 w-6 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Open / In Progress</p>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {openDeficiencies}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-rose-100">
                                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Critical / High Priority</p>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {criticalDeficiencies}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-red-100">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Deficiencies List */}
                {filteredDeficiencies.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <div className="max-w-md mx-auto">
                                <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                    {searchQuery || statusFilter !== "all" || severityFilter !== "all"
                                        ? "No Matching Deficiencies"
                                        : "No Deficiencies Found"}
                                </h3>
                                <p className="text-slate-600">
                                    {searchQuery || statusFilter !== "all" || severityFilter !== "all"
                                        ? "Try adjusting your filters or search query"
                                        : "Great news! There are currently no deficiencies to track."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {Object.entries(groupedByClient).map(([clientId, clientDeficiencies]) => {
                            const client = clients.find(c => c.id === clientId);
                            const property = properties.find(p => p.id === clientDeficiencies[0]?.property_id);
                            return (
                                <ClientDeficiencyGroupCard
                                    key={clientId}
                                    client={client}
                                    property={property}
                                    deficiencies={clientDeficiencies}
                                    userProfile={userProfile}
                                    onEdit={handleEditDeficiency}
                                    onCreateWorkOrder={handleCreateWorkOrder}
                                    onDelete={handleDeleteDeficiency}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Deficiency Form Dialog */}
                <Dialog open={showDeficiencyDialog} onOpenChange={setShowDeficiencyDialog}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editingDeficiency ? "Edit Deficiency" : "Add New Deficiency"}
                            </DialogTitle>
                        </DialogHeader>
                        <DeficiencyForm
                            deficiency={editingDeficiency}
                            inspectionId={editingDeficiency?.inspection_id}
                            propertyId={editingDeficiency?.property_id}
                            clientId={editingDeficiency?.client_id}
                            onSuccess={handleFormSuccess}
                            onCancel={() => {
                                setShowDeficiencyDialog(false);
                                setEditingDeficiency(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!deficiencyToDelete} onOpenChange={() => setDeficiencyToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Deficiency</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete "{deficiencyToDelete?.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}