import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building2, Mail, Phone, MapPin, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";

export default function ClientCard({ client, onEdit, onDelete }) {
    return (
        <div className="group bg-white rounded-2xl border border-slate-100 p-5 transition-all duration-300 hover:shadow-lg hover:border-slate-200">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
                        <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-900">{client.company_name}</h3>
                        <p className="text-sm text-slate-500">{client.contact_name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge 
                        variant="outline" 
                        className={cn(
                            "border",
                            client.status === 'active' 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                        )}
                    >
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(client)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                onClick={() => onDelete(client)}
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
                    <Mail className="h-4 w-4 text-slate-400" />
                    <a href={`mailto:${client.email}`} className="hover:text-orange-600">
                        {client.email}
                    </a>
                </div>
                {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <a href={`tel:${client.phone}`} className="hover:text-orange-600">
                            {client.phone}
                        </a>
                    </div>
                )}
                {client.address && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{client.address}</span>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-100">
                <Link to={createPageUrl(`ClientDetails?id=${client.id}`)}>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                    >
                        <Eye className="h-4 w-4 mr-2" />
                        View Properties & Inspections
                    </Button>
                </Link>
            </div>
        </div>
    );
}