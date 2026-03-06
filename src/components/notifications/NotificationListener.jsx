import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ClipboardCheck, AlertTriangle, CheckCircle2, Bell, User } from "lucide-react";

export default function NotificationListener() {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);
                
                if (user) {
                    const profiles = await base44.entities.UserProfile.list();
                    const profile = profiles.find(p => p.user_id === user.id);
                    setUserProfile(profile);
                }
            } catch (err) {
                console.error("Error loading user:", err);
            }
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        // Subscribe to Inspection changes
        const unsubInspections = base44.entities.Inspection.subscribe(async (event) => {
            try {
                const inspection = event.data;
                if (!inspection) return;

                // New inspection assigned to current user
                if (event.type === 'create' && inspection.inspector_id === currentUser.id) {
                    const clients = await base44.entities.Client.list();
                    const client = clients.find(c => c.id === inspection.client_id);
                    
                    toast.success(
                        `New inspection assigned: ${client?.company_name || 'Unknown Client'}`,
                        {
                            icon: <ClipboardCheck className="h-5 w-5" />,
                            duration: 5000,
                        }
                    );
                }

                // Status changes
                if (event.type === 'update') {
                    const isAssignedToUser = inspection.inspector_id === currentUser.id;
                    const isAdmin = userProfile?.role === 'admin';
                    
                    // Only notify if assigned to user or user is admin
                    if (isAssignedToUser || isAdmin) {
                        // Completed status
                        if (inspection.status === 'completed') {
                            const clients = await base44.entities.Client.list();
                            const client = clients.find(c => c.id === inspection.client_id);
                            
                            toast.success(
                                `Inspection completed: ${client?.company_name || 'Unknown Client'}`,
                                {
                                    icon: <CheckCircle2 className="h-5 w-5" />,
                                    duration: 4000,
                                }
                            );
                        }
                        
                        // Requires follow-up status
                        if (inspection.status === 'requires_followup') {
                            const clients = await base44.entities.Client.list();
                            const client = clients.find(c => c.id === inspection.client_id);
                            
                            toast.warning(
                                `Follow-up required: ${client?.company_name || 'Unknown Client'}`,
                                {
                                    icon: <AlertTriangle className="h-5 w-5" />,
                                    duration: 6000,
                                }
                            );
                        }

                        // Inspector assignment change
                        if (inspection.inspector_id === currentUser.id && event.old_data?.inspector_id !== currentUser.id) {
                            const clients = await base44.entities.Client.list();
                            const client = clients.find(c => c.id === inspection.client_id);
                            
                            toast.info(
                                `You've been assigned to: ${client?.company_name || 'Unknown Client'}`,
                                {
                                    icon: <User className="h-5 w-5" />,
                                    duration: 5000,
                                }
                            );
                        }
                    }
                }
            } catch (err) {
                console.error("Error processing inspection notification:", err);
            }
        });

        // Subscribe to Deficiency changes
        const unsubDeficiencies = base44.entities.Deficiency.subscribe(async (event) => {
            try {
                if (event.type !== 'create') return;
                
                const deficiency = event.data;
                if (!deficiency) return;

                // Get associated inspection
                const inspections = await base44.entities.Inspection.filter({ id: deficiency.inspection_id });
                const inspection = inspections[0];
                
                if (!inspection) return;

                const isAssignedToUser = inspection.inspector_id === currentUser.id;
                const isAdmin = userProfile?.role === 'admin';
                
                // Notify if assigned to user or user is admin
                if (isAssignedToUser || isAdmin) {
                    const clients = await base44.entities.Client.list();
                    const client = clients.find(c => c.id === deficiency.client_id);
                    
                    const severityColors = {
                        critical: 'error',
                        high: 'warning',
                        medium: 'info',
                        low: 'info'
                    };
                    
                    const toastType = severityColors[deficiency.severity] || 'info';
                    
                    toast[toastType](
                        `New ${deficiency.severity} deficiency: ${client?.company_name || 'Unknown Client'}`,
                        {
                            description: deficiency.title || deficiency.description?.substring(0, 60),
                            icon: <AlertTriangle className="h-5 w-5" />,
                            duration: 6000,
                        }
                    );
                }
            } catch (err) {
                console.error("Error processing deficiency notification:", err);
            }
        });

        return () => {
            unsubInspections();
            unsubDeficiencies();
        };
    }, [currentUser, userProfile]);

    return null; // This component doesn't render anything
}