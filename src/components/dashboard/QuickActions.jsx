import React from "react";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Building2, Users, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function QuickActions() {
    const [userProfile, setUserProfile] = React.useState(null);

    React.useEffect(() => {
        const loadUser = async () => {
            try {
                const user = await base44.auth.me();
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

    const actions = [
        { 
            label: "New Inspection", 
            icon: ClipboardCheck, 
            href: "Inspections?new=true",
            primary: true 
        },
        ...(userProfile?.role === "admin" ? [
            { 
                label: "Add Client", 
                icon: Users, 
                href: "Clients?new=true" 
            }
        ] : [])
    ];

    return (
        <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
                <Link key={action.label} to={createPageUrl(action.href)}>
                    <Button
                        variant={action.primary ? "default" : "outline"}
                        className={action.primary 
                            ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-orange-200 border-0"
                            : "border-slate-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                        }
                    >
                        <action.icon className="h-4 w-4 mr-2" />
                        {action.label}
                    </Button>
                </Link>
            ))}
        </div>
    );
}