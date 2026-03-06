import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import { ShieldOff } from "lucide-react";

export default function Disabled() {
    const handleLogout = () => {
        base44.auth.logout();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center">
                    <div className="mb-6">
                        <div className="inline-flex p-4 rounded-full bg-red-100 mb-4">
                            <ShieldOff className="h-12 w-12 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Access Disabled
                        </h1>
                        <p className="text-slate-600">
                            Your access to this application has been disabled. Please contact your administrator for assistance.
                        </p>
                    </div>
                    <Button 
                        onClick={handleLogout}
                        className="w-full bg-slate-600 hover:bg-slate-700"
                    >
                        Log Out
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}