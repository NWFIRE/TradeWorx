import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths, subMonths } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TechnicianMonthly() {
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Get current user
    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => base44.auth.me(),
    });

    // Fetch inspections
    const { data: inspections = [] } = useQuery({
        queryKey: ["inspections"],
        queryFn: () => base44.entities.Inspection.list(),
    });

    // Filter inspections for current technician in current month
    const monthInspections = useMemo(() => {
        if (!user || !inspections.length) return {};

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        const filtered = inspections.filter(inspection => {
            const inspectionDate = new Date(inspection.scheduled_date);
            return (
                inspection.inspector_id === user.id &&
                inspectionDate >= monthStart &&
                inspectionDate <= monthEnd
            );
        });

        // Group by date
        const grouped = {};
        filtered.forEach(inspection => {
            const dateKey = inspection.scheduled_date;
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(inspection);
        });

        return grouped;
    }, [inspections, user, currentDate]);

    // Generate calendar days
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const getStatusColor = (status) => {
        const colors = {
            scheduled: "bg-blue-100 text-blue-800",
            in_progress: "bg-yellow-100 text-yellow-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-gray-100 text-gray-800",
        };
        return colors[status] || "bg-gray-100 text-gray-800";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-slate-900">My Monthly Schedule</h1>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline"
                            size="icon"
                            onClick={handlePrevMonth}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 py-2 text-lg font-semibold min-w-48 text-center">
                            {format(currentDate, "MMMM yyyy")}
                        </div>
                        <Button 
                            variant="outline"
                            size="icon"
                            onClick={handleNextMonth}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <Card>
                    <CardContent className="p-6">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-2 mb-4">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                                <div key={day} className="text-center font-semibold text-slate-600 py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar days */}
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDays.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const dayInspections = monthInspections[dateKey] || [];
                                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                                return (
                                    <div
                                        key={dateKey}
                                        className={`min-h-32 p-2 rounded-lg border-2 ${
                                            isCurrentMonth
                                                ? "bg-white border-slate-200"
                                                : "bg-slate-50 border-slate-100"
                                        }`}
                                    >
                                        <div className={`text-sm font-semibold mb-2 ${
                                            isCurrentMonth ? "text-slate-900" : "text-slate-400"
                                        }`}>
                                            {format(day, "d")}
                                        </div>
                                        <div className="space-y-1">
                                            {dayInspections.map(inspection => (
                                                <Link
                                                    key={inspection.id}
                                                    to={createPageUrl(`InspectionDetails?inspection_id=${inspection.id}`)}
                                                    className={`text-xs p-1 rounded cursor-pointer block hover:opacity-80 transition-opacity truncate ${getStatusColor(inspection.status)}`}
                                                    title={`${inspection.inspection_type} - ${inspection.status}`}
                                                >
                                                    {inspection.inspection_type}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Total Inspections</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-900">
                                {Object.values(monthInspections).flat().length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Scheduled</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {Object.values(monthInspections).flat().filter(i => i.status === "scheduled").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">In Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">
                                {Object.values(monthInspections).flat().filter(i => i.status === "in_progress").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {Object.values(monthInspections).flat().filter(i => i.status === "completed").length}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}