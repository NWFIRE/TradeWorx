import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ClipboardCheck,
    Building2,
    Users,
    User,
    BarChart3,
    Menu,
    X,
    Flame,
    ChevronRight,
    ChevronLeft,
    LogOut,
    AlertCircle,
    FileText
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import InstallPrompt from "@/components/mobile/InstallPrompt";
import OfflineIndicator from "@/components/offline/OfflineIndicator";
import NotificationListener from "@/components/notifications/NotificationListener";

const navigation = [
    { name: "Dashboard", href: "Dashboard", icon: LayoutDashboard },
    { name: "Inspections", href: "Inspections", icon: ClipboardCheck },
    { name: "Recurring Inspections", href: "RecurringInspections", icon: ClipboardCheck, adminOnly: true },
    { name: "Deficiencies", href: "Deficiencies", icon: AlertCircle },
    { name: "Clients", href: "Clients", icon: Users, adminOnly: true },
    { name: "Team", href: "Users", icon: Users, adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [openDeficiencyCount, setOpenDeficiencyCount] = useState(0);

    React.useEffect(() => {
        const loadUserProfile = async () => {
            try {
                const user = await base44.auth.me();
                if (user) {
                    const profiles = await base44.entities.UserProfile.list();
                    const profile = profiles.find(p => p.user_id === user.id);
                    setUserProfile(profile);
                    
                    // Redirect disabled users to Disabled page
                    if (profile?.status === 'disabled' && currentPageName !== 'Disabled') {
                        window.location.href = createPageUrl("Disabled");
                    }

                    // Load open deficiency count for admins
                    if (profile?.role === 'admin') {
                        const deficiencies = await base44.entities.Deficiency.filter({ status: 'open' });
                        setOpenDeficiencyCount(deficiencies.length);
                    }
                }
            } catch (err) {
                console.error("Error loading user profile:", err);
            }
        };
        loadUserProfile();
    }, [currentPageName]);

    // Set mobile-optimized meta tags
    React.useEffect(() => {
        // Viewport
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const viewportContent = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        
        if (viewportMeta) {
            viewportMeta.setAttribute('content', viewportContent);
        } else {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = viewportContent;
            document.head.appendChild(meta);
        }

        // Mobile web app capable
        const appleCapable = document.createElement('meta');
        appleCapable.name = 'apple-mobile-web-app-capable';
        appleCapable.content = 'yes';
        document.head.appendChild(appleCapable);

        // Status bar style
        const statusBar = document.createElement('meta');
        statusBar.name = 'apple-mobile-web-app-status-bar-style';
        statusBar.content = 'black-translucent';
        document.head.appendChild(statusBar);

        // Theme color
        const themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        themeColor.content = '#0f172a';
        document.head.appendChild(themeColor);

        return () => {
            appleCapable.remove();
            statusBar.remove();
            themeColor.remove();
        };
    }, []);

    // Register service worker
    React.useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/serviceWorker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }, []);

    const handleLogout = () => {
        base44.auth.logout();
    };

    const filteredNavigation = navigation.filter(item => 
        !item.adminOnly || userProfile?.role === "admin"
    );

    // Don't show layout for Disabled page
    if (currentPageName === 'Disabled') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-slate-900">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                    style={{ touchAction: 'none' }}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed top-0 left-0 z-50 w-64 bg-blue-900 border-r border-blue-800/50 transition-transform duration-300 ease-out lg:translate-x-0 shadow-2xl flex flex-col",
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
            style={{ 
                height: '100vh',
                height: '100dvh',
                touchAction: 'pan-y'
            }}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-500 bg-gray-700 flex-shrink-0">
                    <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
                        <img 
                              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/2014ca4e0_IMG_5002.png" 
                              alt="NW FIRE & SAFETY" 
                              className="h-10 brightness-110"
                          />
                    </Link>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="lg:hidden text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                    {userProfile?.role === "customer" ? (
                        <Link
                            to={createPageUrl("CustomerPortal")}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-4 rounded-lg text-sm font-medium transition-all duration-200 touch-manipulation block w-full",
                                currentPageName === "CustomerPortal"
                                    ? "bg-gradient-to-r from-orange-400 to-orange-700 text-white shadow-lg shadow-orange-500/30"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            )}
                        >
                            <FileText className={cn("h-5 w-5", currentPageName === "CustomerPortal" ? "text-white" : "text-slate-500")} />
                            <span>My Reports</span>
                            {currentPageName === "CustomerPortal" && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </Link>
                    ) : (
                        filteredNavigation.map((item) => {
                            const isActive = currentPageName === item.href || 
                                (item.href === "Dashboard" && currentPageName === "Home");
                            return (
                                <Link
                                    key={item.name}
                                    to={createPageUrl(item.href)}
                                    onClick={() => setSidebarOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-4 rounded-lg text-sm font-medium transition-all duration-200 touch-manipulation block w-full",
                                        isActive
                                            ? "bg-gradient-to-r from-orange-400 to-orange-700 text-white shadow-lg shadow-orange-500/30"
                                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    )}
                                >
                                    <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500")} />
                                    <span>{item.name}</span>
                                    {item.href === "Deficiencies" && userProfile?.role === "admin" && openDeficiencyCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                                            {openDeficiencyCount > 99 ? "99+" : openDeficiencyCount}
                                        </span>
                                    )}
                                    {isActive && item.href !== "Deficiencies" && <ChevronRight className="h-4 w-4 ml-auto" />}
                                </Link>
                            );
                        })
                    )}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 border-t border-slate-800/50 space-y-2 bg-black flex-shrink-0">
                    <Link
                        to={createPageUrl("Account")}
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                    >
                        <User className="h-5 w-5 text-slate-500" />
                        Account
                    </Link>
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/50"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5 mr-3" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Mobile header */}
                <header 
                    className="sticky top-0 z-30 bg-gray-400 border-b border-gray-300 lg:hidden print:hidden"
                    style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                >
                    <div className="flex items-center justify-between px-4 h-16">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-slate-900 hover:text-slate-700"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                        <img 
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/2014ca4e0_IMG_5002.png" 
                            alt="NW FIRE & SAFETY" 
                            className="h-8 brightness-110"
                        />
                        <div className="w-10" />
                    </div>
                </header>

                {/* Page content */}
                <main className="min-h-screen bg-gradient-to-br from-white via-slate-400 to-slate-600 pb-20 lg:pb-0">
                    {children}
                </main>

                {/* Install Prompt */}
                <InstallPrompt />

                {/* Offline Indicator */}
                <OfflineIndicator />

                {/* Real-time Notifications */}
                <NotificationListener />
                </div>
                </div>
                );
                }