import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, ClipboardCheck, AlertCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
    const location = useLocation();
    
    const navItems = [
        { name: "Dashboard", icon: LayoutDashboard, href: createPageUrl("Dashboard") },
        { name: "Inspections", icon: ClipboardCheck, href: createPageUrl("Inspections") },
        { name: "Deficiencies", icon: AlertCircle, href: createPageUrl("Deficiencies") },
        { name: "Account", icon: User, href: createPageUrl("Account") }
    ];

    const isActive = (href) => {
        const pageName = href.split('/').pop().split('?')[0];
        return location.pathname.includes(pageName) || 
               (pageName === "Dashboard" && location.pathname === "/");
    };

    return (
        <nav 
            className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 lg:hidden z-50"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="grid grid-cols-4 h-16">
                {navItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-colors select-none",
                                active 
                                    ? "text-orange-500" 
                                    : "text-slate-400 hover:text-slate-300"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="text-xs font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}