import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";

const fireSystems = [
    "Fire Alarm System",
    "Sprinkler System",
    "Fire Extinguishers",
    "Emergency Lighting",
    "Exit Signs",
    "Smoke Detectors",
    "Fire Doors",
    "Standpipe System",
    "Fire Pump",
    "Kitchen Suppression System"
];

export default function PropertyForm({ open, onClose, property, clients, onSave, isSaving }) {
    const [formData, setFormData] = useState({
        name: "",
        client_id: "",
        fire_systems: [],
        notes: ""
    });

    useEffect(() => {
        if (property) {
            setFormData({
                name: property.name || "",
                client_id: property.client_id || "",
                fire_systems: property.fire_systems || [],
                notes: property.notes || ""
            });
        } else {
            setFormData({
                name: "",
                client_id: "",
                fire_systems: [],
                notes: ""
            });
        }
    }, [property, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const toggleFireSystem = (system) => {
        setFormData(prev => ({
            ...prev,
            fire_systems: prev.fire_systems.includes(system)
                ? prev.fire_systems.filter(s => s !== system)
                : [...prev.fire_systems, system]
        }));
    };

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-xl">
                        {property ? "Edit Property" : "Add New Property"}
                    </SheetTitle>
                    <SheetDescription>
                        {property ? "Update property information" : "Enter the details for the new property"}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="client_id">Client *</Label>
                        <Select
                            value={formData.client_id}
                            onValueChange={(value) => setFormData({...formData, client_id: value})}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                                {clients?.map(client => (
                                    <SelectItem key={client.id} value={client.id}>
                                        {client.company_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Property Name & Address</Label>
                        <Textarea
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder="Main Office Building, 123 Main Street, City, State 12345"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Fire Safety Systems</Label>
                        <div className="grid grid-cols-1 gap-2 p-4 bg-slate-50 rounded-xl">
                            {fireSystems.map(system => (
                                <div key={system} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={system}
                                        checked={formData.fire_systems.includes(system)}
                                        onCheckedChange={() => toggleFireSystem(system)}
                                    />
                                    <label 
                                        htmlFor={system} 
                                        className="text-sm text-slate-700 cursor-pointer"
                                    >
                                        {system}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            placeholder="Additional notes about this property..."
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
                            {property ? "Update" : "Create"} Property
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}