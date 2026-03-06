import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2 } from "lucide-react";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyForm from "@/components/properties/PropertyForm";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function Properties() {
    const [showForm, setShowForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);
    const [deletingProperty, setDeletingProperty] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const queryClient = useQueryClient();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('new') === 'true') {
            setShowForm(true);
        }
    }, []);

    const { data: properties = [], isLoading: loadingProperties } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list('-created_date'),
    });

    const { data: clients = [], isLoading: loadingClients } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const isLoading = loadingProperties || loadingClients;

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Property.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            setShowForm(false);
            toast.success("Property created successfully");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Property.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            setShowForm(false);
            setEditingProperty(null);
            toast.success("Property updated successfully");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Property.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            setDeletingProperty(null);
            toast.success("Property deleted successfully");
        },
    });

    const handleSave = (data) => {
        if (editingProperty) {
            updateMutation.mutate({ id: editingProperty.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (property) => {
        setEditingProperty(property);
        setShowForm(true);
    };

    const getClientById = (id) => clients.find(c => c.id === id);

    const filteredProperties = properties.filter(property => {
        const matchesSearch = 
            property.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            property.address?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || property.property_type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Properties
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Manage properties and their fire safety systems
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            setEditingProperty(null);
                            setShowForm(true);
                        }}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-200"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Property
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search properties..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-slate-200"
                        />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-full sm:w-48 bg-white">
                            <SelectValue placeholder="Property type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="commercial">Commercial</SelectItem>
                            <SelectItem value="residential">Residential</SelectItem>
                            <SelectItem value="industrial">Industrial</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="educational">Educational</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="warehouse">Warehouse</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Properties Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-64 rounded-2xl" />
                        ))}
                    </div>
                ) : filteredProperties.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProperties.map((property) => (
                            <PropertyCard
                                key={property.id}
                                property={property}
                                client={getClientById(property.client_id)}
                                onEdit={handleEdit}
                                onDelete={setDeletingProperty}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Building2}
                        title="No properties found"
                        description={searchQuery || filterType !== "all"
                            ? "Try adjusting your filters" 
                            : "Add your first property to get started"}
                        action={!searchQuery && filterType === "all" ? "Add Property" : undefined}
                        onAction={() => setShowForm(true)}
                    />
                )}

                {/* Property Form */}
                <PropertyForm
                    open={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditingProperty(null);
                    }}
                    property={editingProperty}
                    clients={clients}
                    onSave={handleSave}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />

                {/* Delete Confirmation */}
                <AlertDialog open={!!deletingProperty} onOpenChange={() => setDeletingProperty(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Property?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete {deletingProperty?.name}? 
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteMutation.mutate(deletingProperty.id)}
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