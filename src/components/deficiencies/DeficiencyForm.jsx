import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DeficiencyForm({ deficiency, inspectionId, propertyId, clientId, onSuccess, onCancel }) {
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        severity: "medium",
        category: "other",
        location: "",
        status: "open",
        assigned_to: "",
        assigned_to_name: "",
        due_date: "",
        corrective_action: "",
        code_reference: "",
        photos: [],
        ...deficiency
    });
    const [uploading, setUploading] = useState(false);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                const profiles = await base44.entities.UserProfile.list();
                const allUsers = await base44.entities.User.list();
                const enrichedUsers = allUsers.map(user => ({
                    ...user,
                    profile: profiles.find(p => p.user_id === user.id)
                }));
                setUsers(enrichedUsers);
            } catch (error) {
                console.error("Error loading users:", error);
            }
        };
        loadUsers();
    }, []);

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        setUploading(true);
        
        try {
            const uploadedUrls = [];
            for (const file of files) {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                uploadedUrls.push(file_url);
            }
            setFormData(prev => ({
                ...prev,
                photos: [...prev.photos, ...uploadedUrls]
            }));
            toast.success("Photos uploaded successfully");
        } catch (error) {
            toast.error("Failed to upload photos");
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const data = {
                ...formData,
                inspection_id: inspectionId,
                property_id: propertyId,
                client_id: clientId
            };

            if (deficiency?.id) {
                await base44.entities.Deficiency.update(deficiency.id, data);
                toast.success("Deficiency updated successfully");
            } else {
                await base44.entities.Deficiency.create(data);
                toast.success("Deficiency created successfully");
            }
            
            onSuccess?.();
        } catch (error) {
            toast.error("Failed to save deficiency");
        }
    };

    const handleAssignedUserChange = (userId) => {
        const user = users.find(u => u.id === userId);
        setFormData(prev => ({
            ...prev,
            assigned_to: userId,
            assigned_to_name: user?.full_name || ""
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <Label>Title *</Label>
                    <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Brief description of the issue"
                        required
                    />
                </div>

                <div className="md:col-span-2">
                    <Label>Description *</Label>
                    <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed description of the deficiency"
                        rows={3}
                        required
                    />
                </div>

                <div>
                    <Label>Severity *</Label>
                    <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fire_alarm">Fire Alarm</SelectItem>
                            <SelectItem value="sprinkler_system">Sprinkler System</SelectItem>
                            <SelectItem value="fire_extinguisher">Fire Extinguisher</SelectItem>
                            <SelectItem value="emergency_lighting">Emergency Lighting</SelectItem>
                            <SelectItem value="kitchen_suppression">Kitchen Suppression</SelectItem>
                            <SelectItem value="structural">Structural</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Location</Label>
                    <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Specific location"
                    />
                </div>

                <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Assign To</Label>
                    <Select value={formData.assigned_to} onValueChange={handleAssignedUserChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select technician..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null}>Unassigned</SelectItem>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.full_name} {user.profile?.role === "admin" ? "(Admin)" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Due Date</Label>
                    <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                </div>

                <div className="md:col-span-2">
                    <Label>Corrective Action</Label>
                    <Textarea
                        value={formData.corrective_action}
                        onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                        placeholder="Recommended action to resolve this deficiency"
                        rows={2}
                    />
                </div>

                <div className="md:col-span-2">
                    <Label>Code Reference</Label>
                    <Input
                        value={formData.code_reference}
                        onChange={(e) => setFormData({ ...formData, code_reference: e.target.value })}
                        placeholder="e.g., NFPA 10-2.1"
                    />
                </div>

                <div className="md:col-span-2">
                    <Label>Photos</Label>
                    <div className="space-y-3">
                        {formData.photos.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {formData.photos.map((url, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                                        <button
                                            type="button"
                                            onClick={() => removePhoto(idx)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <label>
                            <Button type="button" variant="outline" disabled={uploading} asChild>
                                <span>
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Camera className="h-4 w-4 mr-2" />
                                    )}
                                    {uploading ? "Uploading..." : "Add Photos"}
                                </span>
                            </Button>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-orange-500 to-red-600">
                    {deficiency ? "Update" : "Create"} Deficiency
                </Button>
            </div>
        </form>
    );
}