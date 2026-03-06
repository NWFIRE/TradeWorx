import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from "@/utils";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotAuthorized() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center">
                    <div className="mb-6">
                        <div className="inline-flex p-4 rounded-full bg-orange-100 mb-4">
                            <ShieldAlert className="h-12 w-12 text-orange-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Not Authorized
                        </h1>
                        <p className="text-slate-600">
                            You don't have permission to access this page. Contact your administrator if you believe this is an error.
                        </p>
                    </div>
                    <Link to={createPageUrl("Dashboard")}>
                        <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            Go to Dashboard
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}