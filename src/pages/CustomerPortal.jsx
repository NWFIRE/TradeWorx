import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

export default function CustomerPortal() {
    const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
        queryKey: ["userProfile"],
        queryFn: async () => {
            const user = await base44.auth.me();
            if (!user) return null;
            const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
            return profiles[0] || null;
        },
    });

    const clientId = userProfile?.client_id;

    const { data: inspections, isLoading: isLoadingInspections } = useQuery({
        queryKey: ["customerInspections", clientId],
        queryFn: () => base44.entities.Inspection.filter(
            { client_id: clientId, status: "invoiced" },
            "-completed_date"
        ),
        enabled: !!clientId,
    });

    const { data: client, isLoading: isLoadingClient } = useQuery({
        queryKey: ["customerClient", clientId],
        queryFn: async () => {
            const clients = await base44.entities.Client.filter({ id: clientId });
            return clients[0];
        },
        enabled: !!clientId,
    });

    if (isLoadingProfile || isLoadingInspections || isLoadingClient) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="container mx-auto p-6">
                <EmptyState
                    icon={<AlertCircle className="h-12 w-12 text-blue-400" />}
                    title="Profile Not Found"
                    description="Your user profile could not be loaded. Please contact support."
                />
            </div>
        );
    }

    if (userProfile.role !== "customer" || !clientId) {
        return (
            <div className="container mx-auto p-6">
                <EmptyState
                    icon={<AlertCircle className="h-12 w-12 text-blue-400" />}
                    title="Access Denied"
                    description="You do not have access to the customer portal or your account is not linked to a client."
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 text-white">
                Welcome, {client?.company_name || userProfile.display_name || userProfile.contact_email}!
            </h1>
            <p className="text-slate-300 mb-8">
                Here you can view all your invoiced inspection reports.
            </p>

            {inspections?.length === 0 ? (
                <EmptyState
                    icon={<FileText className="h-12 w-12 text-orange-400" />}
                    title="No Invoiced Reports Yet"
                    description="It looks like you don't have any invoiced inspection reports at the moment."
                />
            ) : (
                <div className="grid gap-6">
                    {inspections?.map((inspection) => (
                        <Card key={inspection.id} className="card-glass hover:shadow-xl transition-shadow duration-200">
                            <CardHeader>
                                <CardTitle className="text-lg text-white">Inspection Report</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Completed on {inspection.completed_date ? format(new Date(inspection.completed_date), "MMM d, yyyy") : "N/A"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-between items-center">
                                <div>
                                    <Badge variant="secondary" className="mr-2 capitalize">
                                        {inspection.inspection_type?.replace(/_/g, " ")}
                                    </Badge>
                                    <Badge variant="outline" className="capitalize">
                                        {inspection.status?.replace(/_/g, " ")}
                                    </Badge>
                                </div>
                                <Link
                                    to={createPageUrl(`CustomerInspectionDetails?id=${inspection.id}`)}
                                    className="btn-primary px-4 py-2 rounded-lg"
                                >
                                    View Report
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}