import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardCheck } from "lucide-react";
import InspectionCard from "@/components/dashboard/InspectionCard";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export default function RecurringInspections() {
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [deletingInspection, setDeletingInspection] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        const loadUserProfile = async () => {
            const user = await base44.auth.me();
            if (user) {
                const profiles = await base44.entities.UserProfile.list();
                const profile = profiles.find(p => p.user_id === user.id);
                setUserProfile(profile);
            }
        };
        loadUserProfile();
    }, []);

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list('-scheduled_date'),
    });

    const { data: properties = [], isLoading: loadingProperties } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: clients = [], isLoading: loadingClients } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const isLoading = loadingInspections || loadingProperties || loadingClients;

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Inspection.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setDeletingInspection(null);
            toast.success("Inspection deleted successfully");
        },
    });

    const getPropertyById = (id) => properties.find(p => p.id === id);
    const getClientById = (id) => clients.find(c => c.id === id);

    // Filter only recurring inspections
    const recurringInspections = inspections.filter(inspection => {
        if (!inspection.is_recurring) return false;

        const matchesStatus = filterStatus === "all" || inspection.status === filterStatus;
        if (!matchesStatus) return false;

        if (searchQuery) {
            const property = getPropertyById(inspection.property_id);
            const client = getClientById(inspection.client_id);
            const matchesSearch = 
                inspection.property_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                property?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        }

        return true;
    });

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Recurring Inspections
                    </h1>
                    <p className="text-slate-500 mt-1">
                        View all inspections set to recur automatically
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search recurring inspections..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-slate-200"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full md:w-48 bg-white">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="scheduled">To Be Completed</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="requires_followup">Follow-up Required</SelectItem>
                            <SelectItem value="invoiced">Invoiced</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Inspections List */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-48 rounded-2xl" />
                        ))}
                    </div>
                ) : recurringInspections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recurringInspections.map((inspection) => (
                            <InspectionCard
                                key={inspection.id}
                                inspection={inspection}
                                property={getPropertyById(inspection.property_id)}
                                client={getClientById(inspection.client_id)}
                                allClients={clients}
                                userProfile={userProfile}
                                onDelete={setDeletingInspection}
                                onReassign={() => queryClient.invalidateQueries({ queryKey: ['inspections'] })}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={ClipboardCheck}
                        title="No recurring inspections found"
                        description={searchQuery || filterStatus !== "all"
                            ? "Try adjusting your filters" 
                            : "No inspections are currently set to recur"}
                    />
                )}

                {/* Delete Confirmation */}
                <AlertDialog open={!!deletingInspection} onOpenChange={() => setDeletingInspection(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Inspection?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this recurring inspection? 
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteMutation.mutate(deletingInspection.id)}
                                className="bg-rose-600 hover:bg-rose-700"
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