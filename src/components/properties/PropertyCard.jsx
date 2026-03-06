import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, MapPin, MoreVertical, Pencil, Trash2, Layers, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const propertyTypeColors = {
    commercial: "bg-blue-100 text-blue-700 border-blue-200",
    residential: "bg-green-100 text-green-700 border-green-200",
    industrial: "bg-amber-100 text-amber-700 border-amber-200",
    healthcare: "bg-rose-100 text-rose-700 border-rose-200",
    educational: "bg-purple-100 text-purple-700 border-purple-200",
    retail: "bg-pink-100 text-pink-700 border-pink-200",
    warehouse: "bg-slate-100 text-slate-700 border-slate-200",
    other: "bg-gray-100 text-gray-700 border-gray-200"
};

export default function PropertyCard({ property, client, onEdit, onDelete }) {
    return (
        <div className="group bg-white rounded-2xl border border-slate-100 p-5 transition-all duration-300 hover:shadow-lg hover:border-slate-200">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">{property.name}</h3>
                        <p className="text-sm text-slate-500">{client?.company_name || "No client"}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge 
                        variant="outline" 
                        className={cn("border capitalize", propertyTypeColors[property.property_type])}
                    >
                        {property.property_type?.replace('_', ' ')}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(property)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => onDelete(property)}
                                className="text-rose-600 focus:text-rose-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{property.address}</span>
                </div>
                <div className="flex items-center gap-4">
                    {property.floors && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Layers className="h-4 w-4 text-slate-400" />
                            <span>{property.floors} floor{property.floors > 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {property.square_footage && (
                        <span className="text-sm text-slate-500">
                            {property.square_footage.toLocaleString()} sq ft
                        </span>
                    )}
                </div>
            </div>

            {property.fire_systems?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {property.fire_systems.slice(0, 3).map((system, i) => (
                        <span 
                            key={i} 
                            className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded-full"
                        >
                            {system}
                        </span>
                    ))}
                    {property.fire_systems.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                            +{property.fire_systems.length - 3} more
                        </span>
                    )}
                </div>
            )}

            {property.next_inspection_due && (
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                    <Calendar className="h-4 w-4" />
                    <span>Next inspection: {format(new Date(property.next_inspection_due), "MMM d, yyyy")}</span>
                </div>
            )}

            <div className="pt-4 border-t border-slate-100">
                <Link to={createPageUrl(`PropertyDetails?id=${property.id}`)}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-slate-600 hover:text-orange-600 hover:bg-orange-50 gap-1"
                    >
                        View Details
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}