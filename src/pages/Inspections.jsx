import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ClipboardCheck, Calendar as CalendarIcon, List, Grid3X3, RefreshCw, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import InspectionCard from "@/components/dashboard/InspectionCard";
import InspectionForm from "@/components/inspections/InspectionForm";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, addMonths, subMonths, parse } from "date-fns";
import { cn } from "@/lib/utils";
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
import { usePullToRefresh, PullToRefreshIndicator } from "@/components/mobile/usePullToRefresh";

export default function Inspections() {
    const [showForm, setShowForm] = useState(false);
    const [editingInspection, setEditingInspection] = useState(null);
    const [deletingInspection, setDeletingInspection] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [viewMode, setViewMode] = useState("monthly");
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentMonthlyView, setCurrentMonthlyView] = useState(new Date());
    const [userProfile, setUserProfile] = useState(null);
    const queryClient = useQueryClient();
    
    const [currentUser, setCurrentUser] = useState(null);

    const handleRefreshData = async () => {
        await queryClient.invalidateQueries();
    };

    const { refreshing, pullDistance } = usePullToRefresh(handleRefreshData);

    useEffect(() => {
        const loadUserProfile = async () => {
            const user = await base44.auth.me();
            setCurrentUser(user);
            if (user) {
                const profiles = await base44.entities.UserProfile.list();
                const profile = profiles.find(p => p.user_id === user.id);
                setUserProfile(profile);
            }
        };
        loadUserProfile();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('new') === 'true') {
            setShowForm(true);
        }
        if (params.get('status')) {
            setFilterStatus(params.get('status'));
        }
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

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const inspection = await base44.entities.Inspection.create(data);
            // If work_order is selected, create a work order (only if property_id exists)
            if (data.report_types?.includes('work_order') && data.property_id) {
                const woNumber = `WO-${Date.now()}`;
                await base44.entities.WorkOrder.create({
                    work_order_number: woNumber,
                    job_date: data.scheduled_date,
                    customer_id: data.client_id,
                    site_id: data.property_id,
                    technician: data.inspector_name,
                    status: "draft",
                    scope_of_work: []
                });
            }
            return inspection;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            queryClient.invalidateQueries({ queryKey: ['workOrders'] });
            setShowForm(false);
            toast.success("Inspection scheduled successfully");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Inspection.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setShowForm(false);
            setEditingInspection(null);
            toast.success("Inspection updated successfully");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Inspection.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setDeletingInspection(null);
            toast.success("Inspection deleted successfully");
        },
    });



    const handleSave = (data) => {
        if (editingInspection) {
            const activeStatuses = ["scheduled", "to_be_completed"];
            if (data.status && !activeStatuses.includes(data.status)) {
                data = { ...data, is_priority: false };
            }
            updateMutation.mutate({ id: editingInspection.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (inspection) => {
        setEditingInspection(inspection);
        setShowForm(true);
    };

    const getPropertyById = (id) => properties.find(p => p.id === id);
    const getClientById = (id) => clients.find(c => c.id === id);

    const filteredInspections = inspections.filter(inspection => {
        // Admin can see all inspections, other users see inspections assigned to them OR unassigned
        const isAdmin = userProfile?.role === "admin";
        
        if (!currentUser && !isAdmin) return false;
        
        // Check if user has access to this inspection
        const hasAccess = isAdmin || inspection.inspector_id === currentUser?.id || !inspection.inspector_id;
        if (!hasAccess) return false;
        
        // Hide invoiced inspections from non-admin users (admin can still see them with "invoiced" filter)
        if (inspection.status === "invoiced") {
            if (!isAdmin) return false;
            if (filterStatus !== "invoiced") return false;
        }
        
        // Apply status filter
        const matchesStatus = filterStatus === "all" || inspection.status === filterStatus;
        if (!matchesStatus) return false;
        
        // Apply search filter (only for admin)
        if (isAdmin && searchQuery) {
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

    // Calendar view
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const getInspectionsForDay = (day) => {
        return filteredInspections.filter(i => {
            if (!i.scheduled_date) return false;
            let scheduledDate;
            if (i.scheduled_date.length === 7) { // YYYY-MM format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM', new Date());
                // For month-only, match if the scheduled month is the same as the day's month
                return isSameMonth(scheduledDate, day);
            } else { // YYYY-MM-DD format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM-dd', new Date());
                return isSameDay(scheduledDate, day);
            }
        });
    };

    return (
        <div className="min-h-screen">
            <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Inspections
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Schedule and manage fire safety inspections
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            setEditingInspection(null);
                            setShowForm(true);
                        }}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-200"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Inspection
                    </Button>
                </div>

                {/* View Toggle & Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === "list" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("list")}
                            className={viewMode === "list" ? "bg-slate-900" : ""}
                        >
                            <List className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">List</span>
                        </Button>
                        <Button
                            variant={viewMode === "calendar" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("calendar")}
                            className={viewMode === "calendar" ? "bg-slate-900" : ""}
                        >
                            <CalendarIcon className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Calendar</span>
                        </Button>
                        <Button
                            variant={viewMode === "monthly" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setViewMode("monthly")}
                            className={viewMode === "monthly" ? "bg-slate-900" : ""}
                        >
                            <CalendarDays className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Monthly</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['inspections'] })}
                            className="hidden md:flex"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="relative flex-1 hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search inspections..."
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

                {/* List View */}
                {viewMode === "list" && (
                    <>
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[...Array(6)].map((_, i) => (
                                    <Skeleton key={i} className="h-48 rounded-2xl" />
                                ))}
                            </div>
                        ) : filteredInspections.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredInspections.map((inspection) => (
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
                                title="No inspections found"
                                description={searchQuery || filterStatus !== "all"
                                    ? "Try adjusting your filters" 
                                    : "Schedule your first inspection to get started"}
                                action={!searchQuery && filterStatus === "all" ? "New Inspection" : undefined}
                                onAction={() => setShowForm(true)}
                            />
                        )}
                    </>
                )}

                {/* Monthly List View */}
                {viewMode === "monthly" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-slate-900">
                                {format(currentMonthlyView, "MMMM yyyy")}
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonthlyView(subMonths(currentMonthlyView, 1))}
                                    className="px-3"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="sr-only md:not-sr-only md:ml-2">Previous</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonthlyView(new Date())}
                                    className="px-3"
                                >
                                    <CalendarDays className="h-4 w-4" />
                                    <span className="ml-2 hidden md:inline">Current Month</span>
                                    <span className="ml-2 inline md:hidden">Today</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonthlyView(addMonths(currentMonthlyView, 1))}
                                    className="px-3"
                                >
                                    <span className="sr-only md:not-sr-only md:mr-2">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {(() => {
                            const monthStart = startOfMonth(currentMonthlyView);
                            const monthEnd = endOfMonth(currentMonthlyView);
                            const monthInspections = filteredInspections.filter(insp => {
                                if (!insp.scheduled_date) return false;
                                let inspDate;
                                if (insp.scheduled_date.length === 7) { // YYYY-MM format
                                    inspDate = parse(insp.scheduled_date, 'yyyy-MM', new Date());
                                    // For month-only, match if the scheduled month is within the current monthly view
                                    return isSameMonth(inspDate, currentMonthlyView);
                                } else { // YYYY-MM-DD format
                                    inspDate = parse(insp.scheduled_date, 'yyyy-MM-dd', new Date());
                                    return inspDate >= monthStart && inspDate <= monthEnd;
                                }
                            });

                            return (
                                <div className="rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                         <span className="text-sm font-medium text-slate-600">
                                             {monthInspections.length} {monthInspections.length === 1 ? 'inspection' : 'inspections'}
                                         </span>
                                     </div>
                                    {monthInspections.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {monthInspections.map((inspection) => (
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
                                            title="No inspections this month"
                                            description="No inspections scheduled for this month"
                                        />
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Calendar View */}
                {viewMode === "calendar" && (
                    <div className="rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-slate-900">
                                {format(currentMonth, "MMMM yyyy")}
                            </h2>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonth(new Date())}
                                >
                                    Today
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="p-2 text-center text-sm font-medium text-slate-500">
                                    {day}
                                </div>
                            ))}
                            {calendarDays.map((day, idx) => {
                                const dayInspections = getInspectionsForDay(day);
                                return (
                                    <div
                                        key={idx}
                                        className={cn(
                                            "min-h-24 p-2 border border-slate-100 rounded-lg transition-colors",
                                            !isSameMonth(day, currentMonth) && "bg-slate-50 text-slate-400",
                                            isToday(day) && "bg-orange-50 border-orange-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm font-medium",
                                            isToday(day) && "text-orange-600"
                                        )}>
                                            {format(day, "d")}
                                        </span>
                                        <div className="mt-1 space-y-1">
                                            {dayInspections.slice(0, 2).map((insp) => (
                                                <div
                                                    key={insp.id}
                                                    className="text-xs p-1 bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 rounded truncate cursor-pointer hover:bg-orange-200"
                                                    onClick={() => handleEdit(insp)}
                                                >
                                                    {insp.property_name || getPropertyById(insp.property_id)?.name || "Inspection"}
                                                </div>
                                            ))}
                                            {dayInspections.length > 2 && (
                                                <span className="text-xs text-slate-500">
                                                    +{dayInspections.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Inspection Form */}
                <InspectionForm
                    open={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditingInspection(null);
                    }}
                    inspection={editingInspection}
                    clients={clients}
                    properties={properties}
                    onSave={handleSave}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                    isAdmin={userProfile?.role === "admin"}
                />

                {/* Delete Confirmation */}
                <AlertDialog open={!!deletingInspection} onOpenChange={() => setDeletingInspection(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Inspection?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this inspection? 
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