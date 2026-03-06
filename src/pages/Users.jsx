import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Mail, User, Shield, Loader2, Key, Edit2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Users() {
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("user");
    const [clientId, setClientId] = useState("");
    const [editingProfile, setEditingProfile] = useState(null);
    const [resetPasswordUser, setResetPasswordUser] = useState(null);
    const [toggleStatusUser, setToggleStatusUser] = useState(null);
    const [deleteUser, setDeleteUser] = useState(null);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // Check admin access
    React.useEffect(() => {
        const checkAccess = async () => {
            try {
                const user = await base44.auth.me();
                if (!user) {
                    navigate(createPageUrl("Dashboard"));
                    return;
                }

                const profiles = await base44.entities.UserProfile.list();
                const profile = profiles.find(p => p.user_id === user.id);

                if (!profile || profile.status !== "active") {
                    navigate(createPageUrl("Disabled"));
                    return;
                }

                if (profile.role !== "admin") {
                    navigate(createPageUrl("NotAuthorized"));
                    return;
                }
            } catch (err) {
                console.error("Error checking access:", err);
                navigate(createPageUrl("Dashboard"));
            }
        };
        checkAccess();
    }, [navigate]);

    // Fetch Base44 users
    const { data: users = [], isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list(),
    });

    // Fetch all UserProfiles
    const { data: profiles = [] } = useQuery({
        queryKey: ['userProfiles'],
        queryFn: () => base44.entities.UserProfile.list(),
    });

    // Fetch all Clients
    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    // Match users with profiles - only show users who have an active profile
    const usersWithProfiles = users
        .map(user => ({
            ...user,
            profile: profiles.find(p => p.user_id === user.id)
        }))
        .filter(user => user.profile); // Only display users with a UserProfile

    const inviteMutation = useMutation({
        mutationFn: async (userData) => {
            // Invite with "user" role first (API only accepts user/admin)
            const inviteRole = userData.role === "customer" ? "user" : userData.role;
            const result = await base44.users.inviteUser(userData.email, inviteRole);
            
            // If customer role was requested, call backend function to set it with client_id
            if (userData.role === "customer" && userData.clientId) {
                try {
                    await base44.functions.invoke('updateUserRole', {
                        email: userData.email,
                        role: "customer",
                        clientId: userData.clientId
                    });
                } catch (err) {
                    console.error("Failed to set customer role:", err);
                    // Don't fail the invitation, customer can be set manually later
                }
            }
            
            return result;
        },
        onSuccess: async () => {
            toast.success("Invitation sent successfully");
            setEmail("");
            setRole("user");
            setClientId("");
            setShowInviteForm(false);
            // Refresh users list
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
        },
        onError: (error) => {
            console.error("Invitation error:", error);
            const errorMsg = error?.message || "Failed to send invitation";
            
            // Show specific error message for admin invitations
            if (errorMsg.includes("registered on Base44 before inviting them as admins")) {
                toast.error("Admin users must register first. Invite them as 'User' instead, then upgrade their role.");
            } else {
                toast.error(errorMsg);
            }
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (data) => {
            const { profileId, userId, displayName, contactEmail, role, status, notes } = data;
            
            // If no profile exists, create it first
            if (!profileId) {
                return await base44.entities.UserProfile.create({
                    user_id: userId,
                    display_name: displayName,
                    contact_email: contactEmail,
                    role,
                    status: status || "active",
                    notes
                });
            }
            
            // Update existing profile
            return await base44.entities.UserProfile.update(profileId, {
                display_name: displayName,
                contact_email: contactEmail,
                role,
                status,
                notes
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success("Profile updated successfully");
            setEditingProfile(null);
        },
        onError: (error) => {
            console.error("Update error:", error);
            toast.error("Failed to update profile");
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async (userEmail) => {
            return await base44.auth.requestPasswordReset(userEmail);
        },
        onSuccess: () => {
            toast.success("Password reset email sent");
            setResetPasswordUser(null);
        },
        onError: () => {
            toast.error("Failed to send password reset email");
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ profileId, currentStatus }) => {
            const newStatus = currentStatus === "active" ? "disabled" : "active";
            return await base44.entities.UserProfile.update(profileId, { status: newStatus });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
            toast.success("User access status updated");
            setToggleStatusUser(null);
        },
        onError: () => {
            toast.error("Failed to update status");
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (email) => {
            // Call backend function to delete user and profile completely
            return await base44.functions.invoke('deleteUser', { email });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userProfiles'] });
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success("Team member removed");
            setDeleteUser(null);
        },
        onError: (error) => {
            console.error("Delete error:", error);
            toast.error("Failed to delete team member");
        }
    });

    const handleInvite = (e) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter an email address");
            return;
        }
        if (role === "customer" && !clientId) {
            toast.error("Please select a client for the customer");
            return;
        }
        inviteMutation.mutate({ email, role, clientId });
    };

    const handleResetPassword = () => {
        if (resetPasswordUser) {
            resetPasswordMutation.mutate(resetPasswordUser.email);
        }
    };

    const handleToggleStatus = () => {
        if (toggleStatusUser && toggleStatusUser.profile) {
            toggleStatusMutation.mutate({ 
                profileId: toggleStatusUser.profile.id, 
                currentStatus: toggleStatusUser.profile.status 
            });
        }
    };

    const handleDeleteUser = () => {
        if (deleteUser && deleteUser.email) {
            deleteUserMutation.mutate(deleteUser.email);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Team Members</h1>
                    <p className="text-slate-500 mt-1 text-sm sm:text-base">Manage your team and invite technicians</p>
                </div>
                
                <div className="mb-6">
                    <Sheet open={showInviteForm} onOpenChange={setShowInviteForm}>
                        <SheetTrigger asChild>
                            <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Invite User
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Invite Team Member</SheetTitle>
                                <SheetDescription>
                                    Send an invitation to a technician or team member to join your app.
                                </SheetDescription>
                            </SheetHeader>
                            <form onSubmit={handleInvite} className="space-y-6 mt-6">
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input
                                        type="email"
                                        placeholder="technician@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select value={role} onValueChange={setRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                             <SelectItem value="user">Technician (User)</SelectItem>
                                             <SelectItem value="customer">Customer</SelectItem>
                                             <SelectItem value="admin">Admin</SelectItem>
                                         </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">
                                        {role === "user" 
                                            ? "Technicians can view and create inspections" 
                                            : role === "customer"
                                            ? "Customers can view their invoiced reports"
                                            : "Admins can manage users and settings"}
                                    </p>
                                </div>
                                {role === "customer" && (
                                    <div className="space-y-2">
                                        <Label>Associate Client</Label>
                                        <Select value={clientId} onValueChange={setClientId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a client" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {clients.map(client => (
                                                    <SelectItem key={client.id} value={client.id}>
                                                        {client.company_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-slate-500">
                                            Select which client this customer is associated with.
                                        </p>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    disabled={inviteMutation.isPending}
                                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                                >
                                    {inviteMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Mail className="h-4 w-4 mr-2" />
                                    )}
                                    Send Invitation
                                </Button>
                            </form>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Users List */}
                <div className="space-y-4">
                    {usersLoading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
                        </div>
                    ) : usersWithProfiles.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <User className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">No team members yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Members ({usersWithProfiles.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {usersWithProfiles.map(user => (
                                       <div key={user.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition">
                                           <div className="flex items-center gap-3 flex-1 min-w-0">
                                               <div className="p-2 rounded-lg bg-slate-100 flex-shrink-0">
                                                   <User className="h-5 w-5 text-slate-600" />
                                               </div>
                                               <div className="flex-1 min-w-0">
                                                   <p className="font-medium text-slate-900 truncate">
                                                       {user.profile?.display_name || user.full_name || "Unnamed"}
                                                   </p>
                                                   <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                               </div>
                                           </div>
                                           <div className="flex items-center gap-2 flex-wrap">
                                               <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                                   user.profile?.status === "active" 
                                                       ? "bg-green-100 text-green-700" 
                                                       : "bg-red-100 text-red-700"
                                               }`}>
                                                   {user.profile?.status === "active" ? "Active" : "Disabled"}
                                               </div>
                                               <div className="flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full bg-slate-100 flex-shrink-0">
                                                   {user.profile?.role === "admin" ? (
                                                       <>
                                                           <Shield className="h-3 w-3 text-orange-600" />
                                                           <span className="text-xs font-medium text-orange-600">Admin</span>
                                                       </>
                                                   ) : user.profile?.role === "customer" ? (
                                                       <>
                                                           <User className="h-3 w-3 text-blue-600" />
                                                           <span className="text-xs font-medium text-blue-600">Customer</span>
                                                       </>
                                                   ) : (
                                                       <>
                                                           <User className="h-3 w-3 text-slate-600" />
                                                           <span className="text-xs font-medium text-slate-600">User</span>
                                                       </>
                                                   )}
                                               </div>
                                               <div className="flex items-center gap-1 ml-auto sm:ml-0">
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       onClick={() => setEditingProfile(user)}
                                                       className="h-8 w-8 flex-shrink-0"
                                                       title="Edit profile"
                                                   >
                                                       <Edit2 className="h-4 w-4 text-slate-600" />
                                                   </Button>
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       onClick={() => setResetPasswordUser(user)}
                                                       className="h-8 w-8 flex-shrink-0"
                                                       title="Reset password"
                                                   >
                                                       <Key className="h-4 w-4 text-slate-600" />
                                                   </Button>
                                                   <Button
                                                       variant="ghost"
                                                       size="icon"
                                                       onClick={() => setDeleteUser(user)}
                                                       className="h-8 w-8 flex-shrink-0"
                                                       title="Delete team member"
                                                   >
                                                       <svg className="h-4 w-4 text-slate-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                   </Button>
                                               </div>
                                           </div>
                                       </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Edit Profile Sheet */}
                <Sheet open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Edit Profile</SheetTitle>
                            <SheetDescription>
                                {editingProfile?.email}
                            </SheetDescription>
                        </SheetHeader>
                        {editingProfile && (
                            <EditProfileForm 
                                user={editingProfile}
                                onSave={(data) => {
                                    updateProfileMutation.mutate({
                                        profileId: editingProfile.profile?.id,
                                        userId: editingProfile.id,
                                        ...data
                                    });
                                }}
                                onToggleStatus={() => setToggleStatusUser(editingProfile)}
                                isLoading={updateProfileMutation.isPending}
                            />
                        )}
                    </SheetContent>
                </Sheet>

                {/* Reset Password Dialog */}
                <AlertDialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password</AlertDialogTitle>
                            <AlertDialogDescription>
                                Send a password reset email to {resetPasswordUser?.email}?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-2 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleResetPassword}
                                disabled={resetPasswordMutation.isPending}
                            >
                                {resetPasswordMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                )}
                                Send Reset Email
                            </AlertDialogAction>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Toggle Status Dialog */}
                <AlertDialog open={!!toggleStatusUser} onOpenChange={(open) => !open && setToggleStatusUser(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {toggleStatusUser?.profile?.status === "active" ? "Disable Access" : "Enable Access"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {toggleStatusUser?.profile?.status === "active" 
                                    ? `Disable access for ${toggleStatusUser?.full_name}?` 
                                    : `Enable access for ${toggleStatusUser?.full_name}?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-2 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleToggleStatus}
                                disabled={toggleStatusMutation.isPending}
                            >
                                {toggleStatusMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                )}
                                Confirm
                            </AlertDialogAction>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete Team Member Dialog */}
                <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Team Member</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove {deleteUser?.full_name} from the team? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="flex gap-2 justify-end">
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteUser}
                                disabled={deleteUserMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {deleteUserMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                )}
                                Delete
                            </AlertDialogAction>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}

function EditProfileForm({ user, onSave, onToggleStatus, isLoading }) {
    const [displayName, setDisplayName] = React.useState(user.profile?.display_name || user.full_name || "");
    const [contactEmail, setContactEmail] = React.useState(user.profile?.contact_email || user.email || "");
    const [role, setRole] = React.useState(user.profile?.role || user.role || "user");
    const [notes, setNotes] = React.useState(user.profile?.notes || "");

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ displayName, contactEmail, role, notes, status: user.profile?.status });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
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
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">Technician (User)</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                    placeholder="Internal notes about this team member..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20"
                />
            </div>

            <div className="space-y-3 pt-4 border-t">
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Save Changes
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onToggleStatus}
                    className="w-full"
                >
                    {user.profile?.status === "active" ? "Disable Access" : "Enable Access"}
                </Button>
            </div>
        </form>
    );
}