import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, User, Save, Trash2 } from "lucide-react";
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Account() {
    const [displayName, setDisplayName] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Check access and load current user
    useEffect(() => {
        const checkAccess = async () => {
            try {
                const user = await base44.auth.me();
                if (!user) {
                    navigate(createPageUrl("Dashboard"));
                    return;
                }
                setCurrentUser(user);

                // Get user profile
                const profiles = await base44.entities.UserProfile.list();
                const profile = profiles.find(p => p.user_id === user.id);
                
                if (!profile) {
                    // Create profile if missing
                    await base44.entities.UserProfile.create({
                        user_id: user.id,
                        display_name: user.full_name || "",
                        contact_email: user.email || "",
                        role: user.role || "user",
                        status: "active"
                    });
                    queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
                } else if (profile.status !== "active") {
                    navigate(createPageUrl("Disabled"));
                    return;
                }

                // Set form values
                setDisplayName(profile?.display_name || user.full_name || "");
                setContactEmail(profile?.contact_email || user.email || "");
            } catch (err) {
                console.error("Error loading account:", err);
                navigate(createPageUrl("Dashboard"));
            }
        };
        checkAccess();
    }, [navigate, queryClient]);

    const { data: profiles = [] } = useQuery({
        queryKey: ['userProfiles'],
        queryFn: () => base44.entities.UserProfile.list(),
    });

    const currentProfile = currentUser ? profiles.find(p => p.user_id === currentUser.id) : null;

    const updateMutation = useMutation({
        mutationFn: async (data) => {
            if (!currentProfile) throw new Error("Profile not found");
            return await base44.entities.UserProfile.update(currentProfile.id, {
                display_name: data.displayName,
                contact_email: data.contactEmail
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
            toast.success("Profile updated successfully");
        },
        onError: () => {
            toast.error("Failed to update profile");
        }
    });

    const deleteAccountMutation = useMutation({
        mutationFn: async () => {
            if (!currentProfile) throw new Error("Profile not found");
            // Delete user profile
            await base44.entities.UserProfile.delete(currentProfile.id);
            // Logout
            base44.auth.logout();
        },
        onSuccess: () => {
            toast.success("Account deleted successfully");
        },
        onError: () => {
            toast.error("Failed to delete account");
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!displayName || !contactEmail) {
            toast.error("Please fill in all fields");
            return;
        }
        updateMutation.mutate({ displayName, contactEmail });
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
                    <p className="text-slate-500 mt-1">Manage your profile information</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>
                            Update your display name and contact email
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label>Display Name</Label>
                                <Input
                                    type="text"
                                    placeholder="Full name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Contact Email</Label>
                                <Input
                                    type="email"
                                    placeholder="contact@example.com"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Auth Email (Read-Only)</Label>
                                <Input
                                    type="email"
                                    value={currentUser.email}
                                    disabled
                                    className="bg-slate-50"
                                />
                                <p className="text-xs text-slate-500">
                                    This is your authentication email and cannot be changed here
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Role (Read-Only)</Label>
                                <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md bg-slate-50">
                                    {currentProfile?.role === "admin" ? (
                                        <>
                                            <User className="h-4 w-4 text-orange-600" />
                                            <span className="text-sm text-orange-600 font-medium">Admin</span>
                                        </>
                                    ) : (
                                        <>
                                            <User className="h-4 w-4 text-slate-600" />
                                            <span className="text-sm text-slate-600 font-medium">User</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                {updateMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Save Changes
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Delete Account Section */}
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="text-red-600">Delete Account</CardTitle>
                        <CardDescription>
                            Permanently delete your account and all associated data
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-600 mb-4">
                            This action cannot be undone. This will permanently delete your account
                            and remove your data from our servers.
                        </p>
                        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Account
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your
                                        account and remove your data from our servers.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => deleteAccountMutation.mutate()}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        {deleteAccountMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        Delete Account
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}