import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/EmptyState";

export default function CustomerInspectionDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const inspectionId = urlParams.get("id");

    const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
        queryKey: ["userProfile"],
        queryFn: async () => {
            const user = await base44.auth.me();
            if (!user) return null;
            const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
            return profiles[0] || null;
        },
    });

    const { data: inspection, isLoading: isLoadingInspection } = useQuery({
        queryKey: ["customerInspection", inspectionId],
        queryFn: async () => {
            const inspections = await base44.entities.Inspection.filter({ id: inspectionId });
            return inspections[0];
        },
        enabled: !!inspectionId,
    });

    const { data: client, isLoading: isLoadingClient } = useQuery({
        queryKey: ["customerClient", inspection?.client_id],
        queryFn: async () => {
            const clients = await base44.entities.Client.filter({ id: inspection?.client_id });
            return clients[0];
        },
        enabled: !!inspection?.client_id,
    });
    
    const { data: property, isLoading: isLoadingProperty } = useQuery({
        queryKey: ["customerProperty", inspection?.property_id],
        queryFn: async () => {
            const properties = await base44.entities.Property.filter({ id: inspection?.property_id });
            return properties[0];
        },
        enabled: !!inspection?.property_id,
    });

    if (isLoadingProfile || isLoadingInspection || isLoadingClient || isLoadingProperty) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!userProfile || userProfile.role !== "customer" || userProfile.client_id !== inspection?.client_id) {
        return (
            <div className="container mx-auto p-6">
                <EmptyState
                    icon={<AlertCircle className="h-12 w-12 text-blue-400" />}
                    title="Access Denied"
                    description="You do not have access to view this inspection report."
                />
            </div>
        );
    }

    if (!inspection) {
        return (
            <div className="container mx-auto p-6">
                <EmptyState
                    icon={<AlertCircle className="h-12 w-12 text-orange-400" />}
                    title="Inspection Not Found"
                    description="The requested inspection report could not be found."
                    action={
                        <Link to={createPageUrl("CustomerPortal")}>
                            <Button className="btn-primary">
                                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
                            </Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    const checklistItems = inspection.checklist_items || [];
    const deficiencies = inspection.deficiencies || [];

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-white">Inspection Details</h1>
                <Link to={createPageUrl("CustomerPortal")}>
                    <Button variant="outline" className="text-slate-300 hover:text-white">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Reports
                    </Button>
                </Link>
            </div>

            <Card className="card-glass mb-6">
                <CardHeader>
                    <CardTitle className="text-white">
                        {property?.name || "Property"} - {client?.company_name}
                    </CardTitle>
                    <CardContent className="px-0 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300 text-sm">
                            <div>
                                <p><strong>Type:</strong> <Badge variant="secondary" className="ml-2 capitalize">{inspection.inspection_type?.replace(/_/g, " ")}</Badge></p>
                                <p className="mt-2"><strong>Status:</strong> <Badge variant="outline" className="ml-2 capitalize">{inspection.status?.replace(/_/g, " ")}</Badge></p>
                                {inspection.overall_result && <p className="mt-2"><strong>Result:</strong> <Badge className="ml-2 capitalize">{inspection.overall_result?.replace(/_/g, " ")}</Badge></p>}
                            </div>
                            <div>
                                {property?.address && <p><strong>Address:</strong> {property.address}</p>}
                                <p className="mt-2"><strong>Inspector:</strong> {inspection.inspector_name || "N/A"}</p>
                                {inspection.completed_date && <p className="mt-2"><strong>Completed:</strong> {format(new Date(inspection.completed_date), "MMM d, yyyy")}</p>}
                            </div>
                        </div>
                    </CardContent>
                </CardHeader>
            </Card>

            {inspection.notes && (
                <Card className="card-glass mb-6">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-300">
                        <p>{inspection.notes}</p>
                    </CardContent>
                </Card>
            )}

            {checklistItems.length > 0 && (
                <Card className="card-glass mb-6">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Checklist Items</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-300">
                        {checklistItems.map((item, index) => (
                            <div key={index} className="pb-2 mb-2 border-b border-slate-700 last:border-b-0 last:pb-0 last:mb-0">
                                <p className="font-semibold">{item.item}</p>
                                <p className="text-sm mt-1">Status: <Badge className="capitalize ml-1">{item.status}</Badge></p>
                                {item.notes && <p className="text-xs text-slate-400 mt-1">Notes: {item.notes}</p>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {deficiencies.length > 0 && (
                <Card className="card-glass mb-6">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Deficiencies</CardTitle>
                    </CardHeader>
                    <CardContent className="text-slate-300">
                        {deficiencies.map((deficiency, index) => (
                            <div key={index} className="pb-2 mb-2 border-b border-slate-700 last:border-b-0 last:pb-0 last:mb-0">
                                <p className="font-semibold">{deficiency.description}</p>
                                <p className="text-sm mt-1">Severity: <Badge className="capitalize ml-1">{deficiency.severity}</Badge></p>
                                {deficiency.location && <p className="text-sm mt-1">Location: {deficiency.location}</p>}
                                {deficiency.corrective_action && <p className="text-sm mt-1">Action: {deficiency.corrective_action}</p>}
                                {deficiency.due_date && <p className="text-sm mt-1">Due: {format(new Date(deficiency.due_date), "MMM d, yyyy")}</p>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}