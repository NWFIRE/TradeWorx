import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    Building2,
    Mail,
    Phone,
    MapPin,
    Calendar,
    ClipboardCheck,
    Plus,
    Trash2
} from "lucide-react";
import InspectionCard from "@/components/dashboard/InspectionCard";
import PropertyCard from "@/components/properties/PropertyCard";
import EmptyState from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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

export default function ClientDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('id');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { data: clientData, isLoading: loadingClient } = useQuery({
        queryKey: ['client', clientId],
        queryFn: () => base44.entities.Client.filter({ id: clientId }),
        enabled: !!clientId,
    });

    const { data: properties = [], isLoading: loadingProperties } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list('-scheduled_date'),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const isLoading = loadingClient || loadingProperties || loadingInspections;
    const client = clientData?.[0];

    const clientProperties = properties.filter(p => p.client_id === clientId);
    const clientInspections = inspections.filter(i => i.client_id === clientId);

    const getPropertyById = (id) => properties.find(p => p.id === id);
    const getClientById = (id) => clients.find(c => c.id === id);

    const deleteClientMutation = useMutation({
        mutationFn: (id) => base44.entities.Client.delete(id),
        onSuccess: () => {
            toast.success("Client deleted successfully");
            navigate(createPageUrl("Clients"));
        },
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-48 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Client Not Found</h2>
                    <Link to={createPageUrl("Clients")}>
                        <Button variant="outline">Back to Clients</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to={createPageUrl("Clients")}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">
                                {client.company_name}
                            </h1>
                            <Badge 
                                variant="outline"
                                className={cn(
                                    "border",
                                    client.status === 'active' 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-50 text-slate-700 border-slate-200"
                                )}
                            >
                                {client.status === 'active' ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Client
                    </Button>
                </div>

                {/* Client Info */}
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <Mail className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Email</p>
                                    <a href={`mailto:${client.email}`} className="font-medium text-slate-900 hover:text-orange-600">
                                        {client.email}
                                    </a>
                                </div>
                            </div>
                            {client.phone && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <Phone className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Phone</p>
                                        <a href={`tel:${client.phone}`} className="font-medium text-slate-900 hover:text-orange-600">
                                            {client.phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                            {client.address && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <MapPin className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Address</p>
                                        <p className="font-medium text-slate-900">{client.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        {client.notes && (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <p className="text-sm text-slate-500 mb-2">Notes</p>
                                <p className="text-slate-700">{client.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Properties */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Properties ({clientProperties.length})
                        </h2>
                        <Link to={createPageUrl("Properties?new=true")}>
                            <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Property
                            </Button>
                        </Link>
                    </div>
                    {clientProperties.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {clientProperties.map((property) => (
                                <PropertyCard
                                    key={property.id}
                                    property={property}
                                    client={client}
                                    onEdit={() => {}}
                                    onDelete={() => {}}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={Building2}
                            title="No properties"
                            description="Add a property for this client to schedule inspections."
                        />
                    )}
                </div>

                {/* Inspections */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Recent Inspections ({clientInspections.length})
                        </h2>
                        <Link to={createPageUrl("Inspections?new=true")}>
                            <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Schedule Inspection
                            </Button>
                        </Link>
                    </div>
                    {clientInspections.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clientInspections.slice(0, 6).map((inspection) => (
                                <InspectionCard
                                    key={inspection.id}
                                    inspection={inspection}
                                    property={getPropertyById(inspection.property_id)}
                                    client={client}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ClipboardCheck}
                            title="No inspections"
                            description="Schedule an inspection for this client's properties."
                        />
                    )}
                </div>

                {/* Delete Confirmation */}
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete {client.company_name}? 
                                This will also delete all associated properties and inspections. 
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteClientMutation.mutate(clientId)}
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