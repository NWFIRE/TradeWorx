import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Flame, FileText, ArrowRight } from "lucide-react";

const reportTemplates = [
    {
        id: "fire_alarm",
        name: "Fire Alarm Inspection Report",
        description: "Comprehensive fire alarm system inspection including control panels, monitoring, and input devices",
        icon: Bell,
        color: "from-blue-500 to-indigo-600",
        page: "FireAlarmReport"
    },
    {
        id: "fire_extinguisher",
        name: "Fire Extinguisher Survey",
        description: "Track and inspect fire extinguishers including location, type, dates, and maintenance status",
        icon: Flame,
        color: "from-orange-500 to-red-600",
        page: "FireExtinguisherSurvey"
    }
];

export default function Templates() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Report Templates</h1>
                    <p className="text-slate-600">Quick access to inspection report forms</p>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reportTemplates.map((template) => {
                        const Icon = template.icon;
                        return (
                            <Card key={template.id} className="hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${template.color} shadow-lg`}>
                                            <Icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-xl mb-1">{template.name}</CardTitle>
                                            <CardDescription>{template.description}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Link to={createPageUrl("Inspections")}>
                                        <Button className="w-full group" variant="outline">
                                            <FileText className="h-4 w-4 mr-2" />
                                            Create Inspection
                                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Select "{template.id.replace('_', ' ')}" as report type when scheduling
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Info Note */}
                <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm text-blue-800">
                        <strong>How to use:</strong> Create an inspection and select the corresponding report type. You'll find a link to open the report form from the inspection details page.
                    </p>
                </div>
            </div>
        </div>
    );
}