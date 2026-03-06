import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, Save, X } from "lucide-react";

export default function ClientForm({ open, onClose, client, onSave, isSaving }) {
    const [formData, setFormData] = useState({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
        status: "active"
    });

    useEffect(() => {
        if (client) {
            setFormData({
                company_name: client.company_name || "",
                contact_name: client.contact_name || "",
                email: client.email || "",
                phone: client.phone || "",
                address: client.address || "",
                notes: client.notes || "",
                status: client.status || "active"
            });
        } else {
            setFormData({
                company_name: "",
                contact_name: "",
                email: "",
                phone: "",
                address: "",
                notes: "",
                status: "active"
            });
        }
    }, [client, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl">
                        {client ? "Edit Client" : "Add New Client"}
                    </SheetTitle>
                    <SheetDescription>
                        {client ? "Update client information" : "Enter the details for the new client"}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name *</Label>
                        <Input
                            id="company_name"
                            value={formData.company_name}
                            onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                            placeholder="Acme Corporation"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contact_name">Contact Name *</Label>
                        <Input
                            id="contact_name"
                            value={formData.contact_name}
                            onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                            placeholder="John Smith"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            placeholder="john@acme.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            placeholder="(555) 123-4567"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                            placeholder="123 Main Street, City, State 12345"
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({...formData, status: value})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            placeholder="Additional notes about this client..."
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {client ? "Update" : "Create"} Client
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}