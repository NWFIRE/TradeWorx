import React from "react";
import { useQuery } from "@tanstack/react-query";
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
    MapPin,
    Layers,
    Calendar,
    ClipboardCheck,
    Plus,
    Flame,
    Users
} from "lucide-react";
import InspectionCard from "@/components/dashboard/InspectionCard";
import EmptyState from "@/components/ui/EmptyState";

const propertyTypeColors = {
    commercial: "bg-blue-100 text-blue-700 border-blue-200",
    residential: "bg-green-100 text-green-700 border-green-200",
    industrial: "bg-amber-100 text-amber-700 border-amber-200",
    healthcare: "bg-rose-100 text-rose-700 border-rose-200",
    educational: "bg-purple-100 text-purple-700 border-purple-200",
    retail: "bg-pink-100 text-pink-700 border-pink-200",
    warehouse: "bg-slate-100 text-slate-700 border-slate-200",
    other: "bg-gray-100 text-gray-700 border-gray-200"
};

export default function PropertyDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('id');

    const { data: propertyData, isLoading: loadingProperty } = useQuery({
        queryKey: ['property', propertyId],
        queryFn: () => base44.entities.Property.filter({ id: propertyId }),
        enabled: !!propertyId,
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list('-scheduled_date'),
    });

    const { data: properties = [] } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const isLoading = loadingProperty || loadingInspections;
    const property = propertyData?.[0];
    const client = clients.find(c => c.id === property?.client_id);

    const propertyInspections = inspections.filter(i => i.property_id === propertyId);
    
    const getPropertyById = (id) => properties.find(p => p.id === id);
    const getClientById = (id) => clients.find(c => c.id === id);

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

    if (!property) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Property Not Found</h2>
                    <Link to={createPageUrl("Properties")}>
                        <Button variant="outline">Back to Properties</Button>
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
                    <Link to={createPageUrl("Properties")}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">
                                {property.name}
                            </h1>
                            <Badge 
                                variant="outline"
                                className={cn("border capitalize", propertyTypeColors[property.property_type])}
                            >
                                {property.property_type?.replace('_', ' ')}
                            </Badge>
                        </div>
                        <p className="text-slate-500">{client?.company_name}</p>
                    </div>
                    <Link to={createPageUrl("Inspections?new=true")}>
                        <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Schedule Inspection
                        </Button>
                    </Link>
                </div>

                {/* Property Info */}
                <Card className="mb-8">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <MapPin className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Address</p>
                                    <p className="font-medium text-slate-900">{property.address}</p>
                                </div>
                            </div>
                            {property.floors && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <Layers className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Floors</p>
                                        <p className="font-medium text-slate-900">
                                            {property.floors} floor{property.floors > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {property.square_footage && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <Building2 className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Size</p>
                                        <p className="font-medium text-slate-900">
                                            {property.square_footage.toLocaleString()} sq ft
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100">
                                    <Users className="h-5 w-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Client</p>
                                    <Link 
                                        to={createPageUrl(`ClientDetails?id=${client?.id}`)}
                                        className="font-medium text-slate-900 hover:text-orange-600"
                                    >
                                        {client?.company_name || "N/A"}
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {property.next_inspection_due && (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Calendar className="h-5 w-5" />
                                    <span>Next inspection due: </span>
                                    <span className="font-medium text-slate-900">
                                        {format(new Date(property.next_inspection_due), "MMM d, yyyy")}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Fire Safety Systems */}
                {property.fire_systems?.length > 0 && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Flame className="h-5 w-5 text-orange-500" />
                                Fire Safety Systems
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {property.fire_systems.map((system, idx) => (
                                    <Badge 
                                        key={idx}
                                        variant="outline"
                                        className="bg-orange-50 text-orange-700 border-orange-200 px-3 py-1"
                                    >
                                        {system}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Notes */}
                {property.notes && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-700">{property.notes}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Inspections */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900">
                            Inspection History ({propertyInspections.length})
                        </h2>
                    </div>
                    {propertyInspections.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {propertyInspections.map((inspection) => (
                                <InspectionCard
                                    key={inspection.id}
                                    inspection={inspection}
                                    property={property}
                                    client={client}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={ClipboardCheck}
                            title="No inspections yet"
                            description="Schedule the first inspection for this property."
                            action="Schedule Inspection"
                            onAction={() => window.location.href = createPageUrl("Inspections?new=true")}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}