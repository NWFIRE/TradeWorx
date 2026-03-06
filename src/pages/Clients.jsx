import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Upload, Loader2 } from "lucide-react";
import ClientCard from "@/components/clients/ClientCard";
import ClientForm from "@/components/clients/ClientForm";
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
import { usePullToRefresh, PullToRefreshIndicator } from "@/components/mobile/usePullToRefresh";

export default function Clients() {
    const [showForm, setShowForm] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [deletingClient, setDeletingClient] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const queryClient = useQueryClient();

    const handleRefreshData = async () => {
        await queryClient.invalidateQueries();
    };

    const { refreshing, pullDistance } = usePullToRefresh(handleRefreshData);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('new') === 'true') {
            setShowForm(true);
        }
    }, []);

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const data = await base44.entities.Client.list();
            return data.sort((a, b) => 
                (a.company_name || '').localeCompare(b.company_name || '')
            );
        },
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Client.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setShowForm(false);
            toast.success("Client created successfully");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setShowForm(false);
            setEditingClient(null);
            toast.success("Client updated successfully");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Client.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setDeletingClient(null);
            toast.success("Client deleted successfully");
        },
    });

    const handleSave = (data) => {
        if (editingClient) {
            updateMutation.mutate({ id: editingClient.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (client) => {
        setEditingClient(client);
        setShowForm(true);
    };

    const handleCSVImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            // Upload file
            const { file_url } = await base44.integrations.Core.UploadFile({ file });

            // Extract data from CSV
            const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url,
                json_schema: {
                    type: "object",
                    properties: {
                        clients: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    company_name: { type: "string" },
                                    contact_name: { type: "string" },
                                    email: { type: "string" },
                                    phone: { type: "string" },
                                    address: { type: "string" },
                                    notes: { type: "string" }
                                },
                                required: ["company_name", "contact_name", "email"]
                            }
                        }
                    }
                }
            });

            if (result.status === "success" && result.output?.clients) {
                // Bulk create clients
                await base44.entities.Client.bulkCreate(result.output.clients);
                queryClient.invalidateQueries({ queryKey: ['clients'] });
                toast.success(`Imported ${result.output.clients.length} clients successfully`);
            } else {
                const errorMsg = result.details || "Failed to import CSV";
                if (errorMsg.includes("utf-8") || errorMsg.includes("encoding")) {
                    toast.error("CSV encoding error. Please save your CSV as UTF-8 and try again.");
                } else {
                    toast.error(errorMsg);
                }
            }
        } catch (error) {
            console.error("CSV import error:", error);
            const errorMsg = error.message || "Failed to import CSV file";
            if (errorMsg.includes("utf-8") || errorMsg.includes("encoding") || errorMsg.includes("unicode")) {
                toast.error("CSV encoding error. Please save your CSV as UTF-8 encoded and try again.");
            } else {
                toast.error(errorMsg);
            }
        } finally {
            setIsImporting(false);
            event.target.value = "";
        }
    };

    const filteredClients = clients.filter(client =>
        client.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen">
            <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Clients
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Manage your client accounts and contacts
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={isImporting}
                            onClick={() => document.getElementById('csv-upload').click()}
                        >
                            {isImporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4 mr-2" />
                            )}
                            Import CSV
                        </Button>
                        <input
                            id="csv-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleCSVImport}
                            className="hidden"
                        />
                        <Button
                            onClick={() => {
                                setEditingClient(null);
                                setShowForm(true);
                            }}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-200"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Client
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search clients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white border-slate-200"
                    />
                </div>

                {/* Clients Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-48 rounded-2xl" />
                        ))}
                    </div>
                ) : filteredClients.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredClients.map((client) => (
                            <ClientCard
                                key={client.id}
                                client={client}
                                onEdit={handleEdit}
                                onDelete={setDeletingClient}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Users}
                        title="No clients found"
                        description={searchQuery 
                            ? "Try adjusting your search terms" 
                            : "Add your first client to get started"}
                        action={!searchQuery ? "Add Client" : undefined}
                        onAction={() => setShowForm(true)}
                    />
                )}

                {/* Client Form */}
                <ClientForm
                    open={showForm}
                    onClose={() => {
                        setShowForm(false);
                        setEditingClient(null);
                    }}
                    client={editingClient}
                    onSave={handleSave}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />

                {/* Delete Confirmation */}
                <AlertDialog open={!!deletingClient} onOpenChange={() => setDeletingClient(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete {deletingClient?.company_name}? 
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteMutation.mutate(deletingClient.id)}
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