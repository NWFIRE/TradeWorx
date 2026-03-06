import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, isWithinInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, Legend 
} from "recharts";
import { 
    FileText, Download, TrendingUp, CheckCircle2, XCircle, AlertTriangle, 
    Building2, Calendar, ClipboardCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ['#f97316', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function Reports() {
    const [timeRange, setTimeRange] = useState("3");
    const [userProfile, setUserProfile] = React.useState(null);
    const [currentUser, setCurrentUser] = React.useState(null);

    React.useEffect(() => {
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

    const { data: inspections = [], isLoading: loadingInspections } = useQuery({
        queryKey: ['inspections'],
        queryFn: () => base44.entities.Inspection.list('-scheduled_date'),
    });

    const { data: properties = [] } = useQuery({
        queryKey: ['properties'],
        queryFn: () => base44.entities.Property.list(),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list(),
    });

    const isLoading = loadingInspections;

    // Filter inspections for non-admin users - only show assigned to them
    const userInspections = inspections.filter(inspection => {
        const isAdmin = userProfile?.role === "admin";
        const isAssignedToUser = inspection.inspector_name === currentUser?.full_name;
        return isAdmin || isAssignedToUser;
    });

    const now = new Date();
    const rangeStart = subMonths(now, parseInt(timeRange));

    const filteredInspections = userInspections.filter(i => {
        if (!i.scheduled_date) return false;
        const date = parseISO(i.scheduled_date);
        return isWithinInterval(date, { start: rangeStart, end: now });
    });

    // Stats
    const stats = {
        total: filteredInspections.length,
        completed: filteredInspections.filter(i => i.status === 'completed').length,
        passed: filteredInspections.filter(i => i.overall_result === 'pass').length,
        failed: filteredInspections.filter(i => i.overall_result === 'fail').length,
        conditional: filteredInspections.filter(i => i.overall_result === 'conditional').length,
    };

    // Monthly trend data
    const getMonthlyData = () => {
        const months = [];
        for (let i = parseInt(timeRange) - 1; i >= 0; i--) {
            const month = subMonths(now, i);
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            
            const monthInspections = userInspections.filter(insp => {
                if (!insp.scheduled_date) return false;
                const date = parseISO(insp.scheduled_date);
                return isWithinInterval(date, { start: monthStart, end: monthEnd });
            });

            months.push({
                month: format(month, 'MMM'),
                total: monthInspections.length,
                passed: monthInspections.filter(i => i.overall_result === 'pass').length,
                failed: monthInspections.filter(i => i.overall_result === 'fail').length,
            });
        }
        return months;
    };

    // Result distribution
    const resultData = [
        { name: 'Pass', value: stats.passed, color: '#22c55e' },
        { name: 'Fail', value: stats.failed, color: '#ef4444' },
        { name: 'Conditional', value: stats.conditional, color: '#f59e0b' },
        { name: 'Pending', value: stats.total - stats.passed - stats.failed - stats.conditional, color: '#94a3b8' },
    ].filter(d => d.value > 0);

    // Property type distribution
    const propertyTypeData = () => {
        const counts = {};
        filteredInspections.forEach(insp => {
            const property = properties.find(p => p.id === insp.property_id);
            if (property?.property_type) {
                counts[property.property_type] = (counts[property.property_type] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
            value
        }));
    };

    // Top clients by inspection count
    const topClients = () => {
        const counts = {};
        filteredInspections.forEach(insp => {
            const client = clients.find(c => c.id === insp.client_id);
            if (client) {
                counts[client.company_name] = (counts[client.company_name] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
    };

    const passRate = stats.completed > 0 
        ? Math.round((stats.passed / stats.completed) * 100) 
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Reports & Analytics
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Inspection performance and trends
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-40 bg-white">
                                <SelectValue placeholder="Time range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">Last Month</SelectItem>
                                <SelectItem value="3">Last 3 Months</SelectItem>
                                <SelectItem value="6">Last 6 Months</SelectItem>
                                <SelectItem value="12">Last Year</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-32 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <Card className="border-slate-100">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Total Inspections</p>
                                            <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600">
                                            <ClipboardCheck className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-100">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Completed</p>
                                            <p className="text-3xl font-bold text-slate-900">{stats.completed}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-blue-500">
                                            <Calendar className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-100">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Pass Rate</p>
                                            <p className="text-3xl font-bold text-emerald-600">{passRate}%</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-emerald-500">
                                            <TrendingUp className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-100">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Failed</p>
                                            <p className="text-3xl font-bold text-rose-600">{stats.failed}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-rose-500">
                                            <XCircle className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Monthly Trend */}
                            <Card className="border-slate-100">
                                <CardHeader>
                                    <CardTitle>Monthly Inspection Trend</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={getMonthlyData()}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="month" stroke="#64748b" />
                                                <YAxis stroke="#64748b" />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        background: 'white', 
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px'
                                                    }}
                                                />
                                                <Legend />
                                                <Bar dataKey="passed" name="Passed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Result Distribution */}
                            <Card className="border-slate-100">
                                <CardHeader>
                                    <CardTitle>Inspection Results</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={resultData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                >
                                                    {resultData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Bottom Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Property Type Distribution */}
                            <Card className="border-slate-100">
                                <CardHeader>
                                    <CardTitle>Inspections by Property Type</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={propertyTypeData()} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis type="number" stroke="#64748b" />
                                                <YAxis dataKey="name" type="category" stroke="#64748b" width={100} />
                                                <Tooltip />
                                                <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Top Clients */}
                            <Card className="border-slate-100">
                                <CardHeader>
                                    <CardTitle>Top Clients by Inspections</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {topClients().map((client, idx) => (
                                            <div key={client.name} className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm",
                                                    idx === 0 ? "bg-orange-500" :
                                                    idx === 1 ? "bg-amber-500" :
                                                    idx === 2 ? "bg-yellow-500" : "bg-slate-400"
                                                )}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-900">{client.name}</p>
                                                </div>
                                                <Badge variant="secondary" className="bg-slate-100">
                                                    {client.count} inspections
                                                </Badge>
                                            </div>
                                        ))}
                                        {topClients().length === 0 && (
                                            <p className="text-slate-500 text-center py-8">
                                                No inspection data available
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}