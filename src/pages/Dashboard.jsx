import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ClipboardCheck, Building2, Users, AlertTriangle, Calendar, CheckCircle, RefreshCw } from "lucide-react";
import { format, isAfter, isBefore, addDays, startOfDay, addHours, startOfMonth, endOfMonth, isSameDay, parse } from "date-fns";
import StatCard from "@/components/dashboard/StatCard";
import InspectionCard from "@/components/dashboard/InspectionCard";
import QuickActions from "@/components/dashboard/QuickActions";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
import { usePullToRefresh, PullToRefreshIndicator } from "@/components/mobile/usePullToRefresh";

export default function Dashboard() {
    const [userProfile, setUserProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [deletingInspection, setDeletingInspection] = useState(null);
    const queryClient = useQueryClient();

    const handleRefreshData = async () => {
        await queryClient.invalidateQueries();
    };

    const { refreshing, pullDistance, isPulling } = usePullToRefresh(handleRefreshData, {
        threshold: 80,
        enabled: true
    });

    // Load current user and profile (combined into single effect)
    React.useEffect(() => {
        const loadUserAndProfile = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
                
                if (user) {
                    const profiles = await base44.entities.UserProfile.list();
                    let profile = profiles.find(p => p.user_id === user.id);
                    
                    // Create profile if it doesn't exist
                    if (!profile) {
                        profile = await base44.entities.UserProfile.create({
                            user_id: user.id,
                            display_name: user.full_name || "",
                            contact_email: user.email || "",
                            role: user.role || "user",
                            status: "active"
                        });
                    }
                    
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error("Error loading user profile:", err);
            }
        };
        loadUserAndProfile();
    }, []);

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list('-scheduled_date', 100),
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

    const today = startOfDay(new Date());
    const nextWeek = addDays(today, 7);
    const firstDayOfCurrentMonth = startOfMonth(new Date());

    // Filter inspections for non-admin users - show assigned to them OR unassigned
    const userInspections = inspections.filter(inspection => {
        const isAdmin = userProfile?.role === "admin";
        // Hide invoiced inspections from non-admin users
        if (!isAdmin && inspection.status === "invoiced") return false;
        if (isAdmin) return true;
        if (!currentUser) return false;
        // Show if assigned to user OR if no inspector assigned
        return inspection.inspector_id === currentUser.id || !inspection.inspector_id;
    });

    const stats = {
        totalInspections: userInspections.length,
        upcomingInspections: userInspections.filter(i => 
            i.status === 'scheduled' && 
            i.scheduled_date && 
            isAfter(parse(i.scheduled_date, 'yyyy-MM-dd', new Date()), today)
        ).length,
        completedInspections: userInspections.filter(i => i.status === 'completed').length,
        clients: clients.length,
        overdueInspections: userInspections.filter(i => {
            if (i.status !== 'scheduled' || !i.scheduled_date) return false;
            let scheduledDate;
            if (i.scheduled_date.length === 7) { // YYYY-MM format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM', new Date());
                const overdueThreshold = addDays(endOfMonth(scheduledDate), 35);
                return isBefore(overdueThreshold, today);
            } else { // YYYY-MM-DD format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM-dd', new Date());
                const overdueThreshold = addDays(scheduledDate, 35);
                return isBefore(overdueThreshold, today);
            }
        }).length,
    };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const upcomingInspections = userInspections
        .filter(i => {
            if (i.status !== 'scheduled' || !i.scheduled_date) return false;
            let scheduledDate;
            if (i.scheduled_date.length === 7) { // YYYY-MM format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM', new Date());
                const scheduledMonth = scheduledDate.getMonth();
                const scheduledYear = scheduledDate.getFullYear();
                return scheduledMonth === currentMonth && scheduledYear === currentYear;
            } else { // YYYY-MM-DD format
                scheduledDate = parse(i.scheduled_date, 'yyyy-MM-dd', new Date());
                const scheduledMonth = scheduledDate.getMonth();
                const scheduledYear = scheduledDate.getFullYear();
                return scheduledMonth === currentMonth && scheduledYear === currentYear && (isSameDay(scheduledDate, today) || isAfter(scheduledDate, today));
            }
        })
        .sort((a, b) => {
            const dateA = a.scheduled_date.length === 7 
                ? parse(a.scheduled_date, 'yyyy-MM', new Date())
                : parse(a.scheduled_date, 'yyyy-MM-dd', new Date());
            const dateB = b.scheduled_date.length === 7
                ? parse(b.scheduled_date, 'yyyy-MM', new Date())
                : parse(b.scheduled_date, 'yyyy-MM-dd', new Date());
            return dateA - dateB;
        })
        .slice(0, 6);

    const getPropertyById = (id) => properties.find(p => p.id === id);
    const getClientById = (id) => clients.find(c => c.id === id);

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Inspection.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
            setDeletingInspection(null);
            toast.success("Inspection deleted successfully");
        },
    });

    const handleRefresh = async () => {
        await queryClient.invalidateQueries();
        toast.success("Dashboard refreshed");
    };



    return (
        <div className="min-h-screen">
             <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} isPulling={isPulling} threshold={80} />
             <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
                  {/* Header */}
                  <div className="mb-6 sm:mb-8">
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                          Dashboard
                      </h1>
                      <p className="text-sm sm:text-base text-slate-500 mt-1">
                          Welcome back. Here's your fire safety inspection overview.
                      </p>
                  </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <QuickActions />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {isLoading ? (
                        <>
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-32 rounded-2xl" />
                            ))}
                        </>
                    ) : (
                        <>
                            <StatCard
                                title="Total Inspections"
                                value={stats.totalInspections}
                                icon={ClipboardCheck}
                                href={createPageUrl("Inspections")}
                            />
                            <StatCard
                                title="Upcoming"
                                value={stats.upcomingInspections}
                                icon={Calendar}
                                subtitle="To be completed"
                                href={createPageUrl("Inspections") + "?status=scheduled"}
                            />
                            {userProfile?.role === "admin" && (
                                 <>
                                     <StatCard
                                         title="Completed"
                                         value={stats.completedInspections}
                                         icon={CheckCircle}
                                         subtitle="Finished inspections"
                                         href={createPageUrl("Inspections")}
                                     />
                                     <StatCard
                                         title="Clients"
                                         value={stats.clients}
                                         icon={Users}
                                         href={createPageUrl("Clients")}
                                     />
                                 </>
                             )}
                        </>
                    )}
                </div>

                {/* Overdue Alert */}
                {stats.overdueInspections > 0 && (
                    <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-rose-500">
                                <AlertTriangle className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-rose-900">
                                    {stats.overdueInspections} Overdue Inspection{stats.overdueInspections > 1 ? 's' : ''}
                                </p>
                                <p className="text-sm text-rose-700">
                                    Please review and reschedule these inspections.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upcoming Inspections */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Upcoming Inspections
                        </h2>
                        <Link 
                            to={createPageUrl("Inspections")}
                            className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        >
                            View All →
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-48 rounded-2xl" />
                            ))}
                        </div>
                    ) : upcomingInspections.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingInspections.map((inspection) => (
                                <InspectionCard
                                    key={inspection.id}
                                    inspection={inspection}
                                    property={getPropertyById(inspection.property_id)}
                                    client={getClientById(inspection.client_id)}
                                    onDelete={setDeletingInspection}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={Calendar}
                            title="No upcoming inspections"
                            description="Schedule your first inspection to get started."
                            action="Schedule Inspection"
                            onAction={() => window.location.href = createPageUrl("Inspections?new=true")}
                        />
                    )}
                </div>

                {/* Delete Confirmation */}
                <AlertDialog open={!!deletingInspection} onOpenChange={() => setDeletingInspection(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Inspection?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this inspection? This action cannot be undone.
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