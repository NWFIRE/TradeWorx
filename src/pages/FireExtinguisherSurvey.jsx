import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Flame,
  Copy,
  Printer
} from "lucide-react";
import SignaturePad from "../components/inspections/SignaturePad";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAutoSave } from "../components/reports/useAutoSave";
import AutoSaveIndicator from "../components/reports/AutoSaveIndicator";
import { useOfflineData } from "../components/offline/useOfflineData";
import { offlineStorage } from "../components/offline/offlineStorage";

const sizeTypes = [
  "2.5lb ABC",
  "5lb ABC",
  "10lb ABC",
  "20lb ABC",
  "2.5G Water",
  "6L K-Class",
  "10lb CO2",
  "15lb CO2",
  "20lb CO2",
  "Other"
];

const manufacturers = [
  "Amerex",
  "Badger",
  "Buckeye",
  "Kidde",
  "First Alert",
  "Ansul",
  "Strike First",
  "Other"
];

const ulRatingMap = {
  "2.5lb ABC": "1A:10B:C",
  "5lb ABC": "2A:10B:C",
  "10lb ABC": "4A:60B:C",
  "20lb ABC": "10A:120B:C",
  "2.5G Water": "2A",
  "6L K-Class": "2A:K",
  "10lb CO2": "10B:C",
  "15lb CO2": "10B:C",
  "20lb CO2": "10B:C"
};

/**
 * HYDRO INTERVAL LOGIC (based on extinguisher type)
 * - ABC dry chemical: 12 years
 * - CO2 / Water / Wet Chemical (K-Class): 5 years
 * - Other: default 5 years
 */
const getHydroIntervalYears = (sizeType) => {
  if (!sizeType) return 5;

  if (sizeType.includes("ABC")) return 12;
  if (sizeType.includes("CO2")) return 5;
  if (sizeType.includes("Water")) return 5;
  if (sizeType.includes("K-Class")) return 5;

  return 5;
};

// Keep your YY input behavior
const formatYY = (value) => {
  const cleaned = String(value ?? "").replace(/\D/g, "");
  if (cleaned.length >= 2) return cleaned.slice(0, 2);
  return cleaned;
};

// Convert 2-digit year ("YY") to 4-digit year using a pivot window
// 00–49 => 2000–2049, 50–99 => 1950–1999
const yyToYear = (yy) => {
  if (!yy || String(yy).length !== 2) return null;
  const n = Number(yy);
  if (Number.isNaN(n)) return null;
  return n <= 49 ? 2000 + n : 1900 + n;
};

const yearToYY = (year) => {
  if (!year || Number.isNaN(Number(year))) return "";
  return String(year).slice(-2).padStart(2, "0");
};

const calcNextHydroYY = (lastHydroYY, intervalYears) => {
  const year = yyToYear(lastHydroYY);
  if (!year) return "";
  const nextYear = year + (intervalYears ?? 5);
  return yearToYY(nextYear);
};

export default function FireExtinguisherSurvey() {
  const urlParams = new URLSearchParams(window.location.search);
  const inspectionId = urlParams.get('id');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [extinguishers, setExtinguishers] = useState([]);
  const [customerSignature, setCustomerSignature] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { isOnline, queueSync } = useOfflineData();

  const { data: inspection, isLoading: loadingInspection } = useQuery({
    queryKey: ['inspection', inspectionId],
    queryFn: () => base44.entities.Inspection.filter({ id: inspectionId }),
    enabled: !!inspectionId,
  });

  const { data: existingExtinguishers = [], isLoading: loadingExtinguishers } = useQuery({
    queryKey: ['extinguishers', inspectionId],
    queryFn: () => base44.entities.FireExtinguisher.filter({ inspection_id: inspectionId }),
    enabled: !!inspectionId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const currentInspection = inspection?.[0];
  const property = properties.find(p => p.id === currentInspection?.property_id);
  const client = clients.find(c => c.id === currentInspection?.client_id);

  useEffect(() => {
    const loadExtinguisherData = async () => {
      // Try to load from cache first if offline
      if (!isOnline) {
        const cachedData = await offlineStorage.getCachedData(`extinguishers_${inspectionId}`);
        if (cachedData && cachedData.length > 0) {
          setExtinguishers(cachedData);
          return;
        }
      }
      
      if (existingExtinguishers.length > 0 && extinguishers.length === 0) {
        setExtinguishers(existingExtinguishers.sort((a, b) => a.number - b.number));
      }
    };
    
    loadExtinguisherData();
  }, [existingExtinguishers, isOnline, inspectionId]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (currentInspection) {
      if (currentInspection.fire_extinguisher_customer_signature) {
        setCustomerSignature(currentInspection.fire_extinguisher_customer_signature);
      }
      if (currentInspection.fire_extinguisher_customer_name) {
        setCustomerName(currentInspection.fire_extinguisher_customer_name);
      }
    }
  }, [currentInspection?.id]);

  const addExtinguisher = () => {
    const nextNumber = extinguishers.length > 0
      ? Math.max(...extinguishers.map(e => e.number || 0)) + 1
      : 1;

    const newExt = {
      inspection_id: inspectionId,
      property_id: currentInspection?.property_id,
      number: nextNumber,
      location: "",
      size_type: "",
      manufacturer: "",
      ul_rating: "",
      mfg_date: "",
      last_hydro: "",
      next_hydro: "",
      last_6yr: "",
      next_6yr: "",
      status: "pass",
      service_completed: "",
      comments: "",
      isNew: true
    };

    setExtinguishers([...extinguishers, newExt]);
    setIsDirty(true);
  };

  /**
   * Central update function with AUTO-HYDRO logic:
   * - When last_hydro changes -> computes next_hydro using interval derived from size_type
   * - When size_type changes -> recomputes next_hydro if last_hydro exists
   */
  const updateExtinguisher = (index, field, value) => {
    const updated = [...extinguishers];
    const current = { ...updated[index] };
    const next = { ...current, [field]: value };

    // Normalize YY fields
    if (field === "mfg_date") next.mfg_date = formatYY(value);
    if (field === "last_hydro") next.last_hydro = formatYY(value);
    if (field === "next_hydro") next.next_hydro = formatYY(value); // (kept for safety)
    if (field === "last_6yr") next.last_6yr = formatYY(value);
    if (field === "next_6yr") next.next_6yr = formatYY(value);

    // If size_type changes, set UL rating (existing behavior)
    if (field === "size_type") {
      const rating = ulRatingMap[value];
      if (rating) next.ul_rating = rating;

      // Recompute next_hydro if last_hydro exists
      const interval = getHydroIntervalYears(value);
      if (next.last_hydro) {
        next.next_hydro = calcNextHydroYY(next.last_hydro, interval);
      } else {
        next.next_hydro = "";
      }
    }

    // If last_hydro changes, recompute next_hydro based on current size_type
    if (field === "last_hydro") {
      const interval = getHydroIntervalYears(next.size_type);
      if (next.last_hydro) {
        next.next_hydro = calcNextHydroYY(next.last_hydro, interval);
      } else {
        next.next_hydro = "";
      }
    }

    updated[index] = next;
    setExtinguishers(updated);
    setIsDirty(true);
  };

  const removeExtinguisher = async (index) => {
    const ext = extinguishers[index];
    if (ext.id) {
      await base44.entities.FireExtinguisher.delete(ext.id);
      queryClient.invalidateQueries({ queryKey: ['extinguishers', inspectionId] });
    }
    setExtinguishers(extinguishers.filter((_, i) => i !== index));
    toast.success("Extinguisher removed");
  };

  const duplicateExtinguisher = (index) => {
    const ext = { ...extinguishers[index] };
    delete ext.id;
    const nextNumber = extinguishers.length > 0
      ? Math.max(...extinguishers.map(e => e.number || 0)) + 1
      : 1;
    setExtinguishers([...extinguishers, { ...ext, number: nextNumber, isNew: true }]);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Validate mandatory fields
    const errors = [];

    if (extinguishers.length === 0) {
      errors.push("At least one fire extinguisher");
    } else {
      // Check each extinguisher for required fields
      const incompleteExtinguishers = [];
      extinguishers.forEach((ext, idx) => {
        if (!ext.location || !ext.size_type) {
          incompleteExtinguishers.push(idx + 1);
        }
      });
      if (incompleteExtinguishers.length > 0) {
        errors.push(`Complete location and size/type for extinguisher(s) #${incompleteExtinguishers.join(", ")}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Please provide: ${errors.join("; ")}`);
      return;
    }

    setIsSaving(true);
    try {
      if (isOnline) {
        // Online - save directly
        for (const ext of extinguishers) {
          const data = { ...ext };
          delete data.isNew;

          if (ext.id) {
            await base44.entities.FireExtinguisher.update(ext.id, data);
          } else {
            const created = await base44.entities.FireExtinguisher.create(data);
            const idx = extinguishers.findIndex(e => e.number === ext.number && !e.id);
            if (idx !== -1) {
              const updated = [...extinguishers];
              updated[idx] = { ...updated[idx], id: created.id };
              setExtinguishers(updated);
            }
          }
        }

        // Save customer name and signature to inspection
        const inspectionUpdates = {};
        if (customerName) {
          inspectionUpdates.fire_extinguisher_customer_name = customerName;
        }
        if (customerSignature) {
          inspectionUpdates.fire_extinguisher_customer_signature = customerSignature;
        }
        if (Object.keys(inspectionUpdates).length > 0) {
          await base44.entities.Inspection.update(inspectionId, inspectionUpdates);
        }
        
        // Auto-create deficiencies for failed extinguishers
        const failedExtinguishers = extinguishers.filter(e => e.status === "fail" || e.status === "needs_service");
        if (failedExtinguishers.length > 0) {
          const existingDeficiencies = await base44.entities.Deficiency.filter({ 
            inspection_id: inspectionId,
            category: "fire_extinguisher"
          });
          
          if (existingDeficiencies.length === 0) {
            const deficiencyDesc = failedExtinguishers.map(e => 
              `#${e.number} at ${e.location}: ${e.status} - ${e.comments || 'Needs attention'}`
            ).join("\n");
            
            await base44.entities.Deficiency.create({
              inspection_id: inspectionId,
              property_id: currentInspection?.property_id,
              client_id: currentInspection?.client_id,
              title: "Fire Extinguisher Issues",
              description: deficiencyDesc,
              severity: failedExtinguishers.some(e => e.status === "fail") ? "high" : "medium",
              category: "fire_extinguisher",
              status: "open"
            });
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['extinguishers', inspectionId] });
        await queryClient.invalidateQueries({ queryKey: ['inspection', inspectionId] });
        await queryClient.invalidateQueries({ queryKey: ['deficiencies'] });
        toast.success("Survey saved successfully");
      } else {
        // Offline - cache and queue for sync
        await offlineStorage.cacheData(`extinguishers_${inspectionId}`, extinguishers);
        
        for (const ext of extinguishers) {
          const data = { ...ext };
          delete data.isNew;
          
          if (ext.id) {
            await queueSync('update_fire_extinguisher', { id: ext.id, updates: data });
          } else {
            await queueSync('create_fire_extinguisher', data);
          }
        }
        
        toast.success("Survey saved offline - will sync when connected");
      }
      
      setIsDirty(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error(isOnline ? "Failed to save survey" : "Failed to save offline");
    }
    setIsSaving(false);
  };

  const handleBackClick = (e) => {
    if (isDirty) {
      e.preventDefault();
      setShowExitDialog(true);
    }
  };

  const { isSaving: isAutoSaving, lastSaved } = useAutoSave(extinguishers, handleSave, { enabled: isDirty });

  if (loadingInspection || loadingExtinguishers) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!currentInspection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Inspection Not Found</h2>
          <Link to={createPageUrl("Inspections")}>
            <Button variant="outline">Back to Inspections</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen print:bg-white">
      <style>{`
        @media print {
          @page { margin: 0.25in; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { margin: 0; padding: 0; line-height: 1.1; font-size: 7pt; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print\\:hidden { display: none !important; }
          .max-w-7xl { max-width: 100%; margin: 0; padding: 0; }
          .px-4, .px-6, .px-8, .py-8 { padding: 0 !important; }
          .mb-6, .mb-4, .mb-3, .mb-2, .mb-1 { margin-bottom: 0.03in !important; }
          .space-y-4 > * + *, .space-y-3 > * + * { margin-top: 0 !important; }
          .h-20, .h-16, .h-10 { height: 0.6in !important; }
          .rounded-2xl, .rounded-xl, .rounded-lg { border-radius: 0 !important; }
          .shadow-lg, .shadow-sm, .shadow { box-shadow: none !important; border: none !important; }
          .border { border: none !important; }
          .text-xl, .text-lg { font-size: 9pt !important; font-weight: bold; }
          .text-base { font-size: 7pt !important; }
          .text-sm { font-size: 6.5pt !important; }
          .text-xs { font-size: 6pt !important; }
          .bg-gradient-to-r, .bg-orange-500 { background: none !important; }
          .p-8, .p-4, .p-2 { padding: 0 !important; }
          .gap-3, .gap-2 { gap: 0 !important; }
          img { display: block !important; max-width: 100% !important; }

          /* Print tables */
          .print-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 6.5pt; 
            margin: 0.03in 0;
          }
          .print-table td, .print-table th { 
            padding: 0.02in 0.04in; 
            border: 0.5px solid #666; 
            vertical-align: middle;
            font-size: 6.5pt;
          }
          .print-table th { 
            font-weight: bold; 
            background: #e8e8e8;
            text-align: center;
          }

          /* Hide screen cards */
          .space-y-4 > div { display: none !important; }

          /* Footer */
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 0.6in;
            display: flex;
            align-items: center;
            padding: 0 0.4in;
            border-top: 1px solid #ccc;
            background: white;
            font-size: 7pt;
          }
          .print-footer-logo {
            height: 0.32in;
            width: auto;
            margin-right: 0.15in;
          }
          .print-footer-text {
            flex: 1;
            text-align: center;
            font-size: 7pt;
            line-height: 1.3;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 print:p-0 overflow-x-hidden">
        {/* Logo and Company Info - Print Only */}
        <div className="hidden print:block text-center mb-2">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png"
            alt="NW Fire & Safety"
            style={{ height: '1.0in', width: 'auto', margin: '0 auto 0.1in auto', display: 'block' }}
          />
          <div style={{ fontSize: '7pt', lineHeight: '1.2', marginBottom: '0.05in' }}>
            <div style={{ fontWeight: 'bold' }}>Northwest Fire & Safety, LLC</div>
            <div>580-540-3119 | 2517 N Van Buren - Enid, OK 73703</div>
          </div>
          <h2 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '0.1in' }}>FIRE EXTINGUISHER SURVEY</h2>
        </div>

        {/* Header */}
        <div className="mb-3 print:mb-2">
          <div className="flex justify-center mb-2 print:hidden">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/ab5e51f05_LOGO-2024-BlackSurround.jpg"
              alt="NW Fire & Safety"
              className="h-16 w-auto"
            />
          </div>

          {/* Company Info */}
          <div className="text-center mb-4 print:hidden text-xs leading-tight">
            <div>Northwest Fire & Safety, LLC</div>
            <div>580-540-3119</div>
            <div>2517 N Van Buren - Enid, OK 73703</div>
            <div>www.nwfireandsafety.com</div>
            <div>OK # AC441117, 466</div>
          </div>

          <div className="no-print mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl("InspectionDetails") + `?id=${inspectionId}`} onClick={handleBackClick}>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-2 rounded-xl bg-orange-500">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Fire Extinguisher Survey</h1>
                <p className="text-slate-500 text-xs truncate">NFPA 10 Requirements</p>
              </div>
              <AutoSaveIndicator isSaving={isAutoSaving} lastSaved={lastSaved} />
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => setShowPreview(true)}
              >
                <Printer className="h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={async () => {
                  try {
                    toast.info("Generating report...");
                    const response = await base44.functions.invoke('generateFireExtinguisherReport', { inspection_id: inspectionId });

                    if (response.data?.html_content) {
                      const blob = new Blob([response.data.html_content], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const newWindow = window.open(url, '_blank');

                      if (newWindow) {
                        toast.success("Report opened in new tab");
                        setTimeout(() => {
                          newWindow.print();
                        }, 500);
                      } else {
                        toast.error("Pop-up blocked - please allow pop-ups to view the report");
                      }
                    } else {
                      toast.error(response.data?.error || "Failed to generate report");
                    }
                  } catch (error) {
                    toast.error(error.response?.data?.error || error.message || "Error generating report");
                  }
                }}
              >
                <Printer className="h-4 w-4" />
                Print Report
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="no-print w-full bg-gradient-to-r from-orange-500 to-red-600 relative overflow-hidden"
          >
            {isSaving && (
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 animate-pulse" />
            )}
            <span className="relative z-10 flex items-center">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Survey
                </>
              )}
            </span>
          </Button>
        </div>

        {/* Print-Only Condensed Table View */}
        <div className="hidden print:block">
          <table className="print-table" style={{ marginBottom: "0.04in" }}>
            <tr>
              <td style={{ width: "20%" }}><strong>Client:</strong></td>
              <td style={{ width: "30%" }}>{client?.company_name || "N/A"}</td>
              <td style={{ width: "20%" }}><strong>Date:</strong></td>
              <td style={{ width: "30%" }}>
                {currentInspection.scheduled_date
                  ? format(new Date(currentInspection.scheduled_date), "MM/dd/yyyy")
                  : "N/A"}
              </td>
            </tr>
            <tr>
              <td><strong>Client Address:</strong></td>
              <td colSpan="3">{client?.address || "N/A"}</td>
            </tr>
            <tr>
              <td><strong>Property:</strong></td>
              <td colSpan="3">{property?.address || client?.address || "N/A"}</td>
            </tr>
            <tr>
              <td><strong>Technician:</strong></td>
              <td colSpan="3">{currentInspection.inspector_name || "N/A"}</td>
            </tr>
          </table>

          {extinguishers.length > 0 && (
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th style={{ width: "20%" }}>Location</th>
                  <th style={{ width: "12%" }}>Size/Type</th>
                  <th style={{ width: "12%" }}>Mfr</th>
                  <th style={{ width: "10%" }}>UL Rating</th>
                  <th style={{ width: "6%" }}>MFG</th>
                  <th style={{ width: "6%" }}>Hydro</th>
                  <th style={{ width: "6%" }}>Next</th>
                  <th style={{ width: "6%" }}>6YR</th>
                  <th style={{ width: "8%" }}>Service</th>
                  <th style={{ width: "8%" }}>Status</th>
                  <th style={{ width: "10%" }}>Comments</th>
                </tr>
              </thead>
              <tbody>
                {extinguishers.map((ext) => (
                  <tr key={ext.id || ext.number}>
                    <td style={{ textAlign: "center" }}>{ext.number}</td>
                    <td>{ext.location || "-"}</td>
                    <td>{ext.size_type || "-"}</td>
                    <td>{ext.manufacturer || "-"}</td>
                    <td>{ext.ul_rating || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.mfg_date || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.last_hydro || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.next_hydro || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.last_6yr || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.service_completed || "-"}</td>
                    <td style={{ textAlign: "center" }}>{ext.status || "-"}</td>
                    <td>{ext.comments || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ textAlign: "center", fontSize: "6pt", marginTop: "0.05in" }}>
            NFPA 10 & Manufacturer Requirements - Total: {(() => {
              const seenNumbers = new Set();
              return extinguishers.filter(ext => {
                if (seenNumbers.has(ext.number)) return false;
                seenNumbers.add(ext.number);
                return true;
              }).length;
            })()} extinguisher(s)
          </div>

          {(customerName || customerSignature) && (
            <div style={{ marginTop: "0.15in", border: "0.5px solid #ccc", padding: "0.05in" }}>
              {customerName && (
                <div style={{ marginBottom: "0.05in" }}>
                  <div style={{ fontSize: "6.5pt", fontWeight: "bold" }}>Customer Name</div>
                  <div style={{ fontSize: "7pt" }}>{customerName}</div>
                </div>
              )}
              {customerSignature && (
                <div>
                  <div style={{ fontSize: "6.5pt", fontWeight: "bold", marginBottom: "0.02in" }}>Customer Signature</div>
                  <img src={customerSignature} alt="Customer Signature" style={{ maxHeight: "0.6in", width: "100%" }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Client & Property Info */}
        <Card className="mb-3 print:hidden">
          <CardContent className="p-4 print:p-2 space-y-3 print:space-y-1 text-sm">
            <div>
              <Label className="text-xs text-slate-500">Client</Label>
              <p className="font-semibold text-slate-900">{client?.company_name || "N/A"}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Address</Label>
              <p className="text-slate-900">{property?.address || client?.address || "N/A"}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">Date</Label>
                <p className="text-slate-900">
                  {currentInspection.scheduled_date
                    ? format(new Date(currentInspection.scheduled_date), "MMM d, yyyy")
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Technician</Label>
                <p className="text-slate-900">{currentInspection.inspector_name || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extinguishers */}
        <h2 className="text-lg font-semibold text-slate-900 mb-4 print:hidden">Extinguishers</h2>

        {extinguishers.length === 0 ? (
          <Card className="mb-4 print:hidden">
            <CardContent className="p-8 text-center text-slate-500">
              <Flame className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="mb-3">No extinguishers added yet</p>
              <Button onClick={addExtinguisher} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add First Extinguisher
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 print:hidden">
            {extinguishers.map((ext, idx, array) => (
              <div key={ext.id || idx} className="space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">#{ext.number}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateExtinguisher(idx)}
                          className="h-8"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExtinguisher(idx)}
                          className="h-8 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Location *</Label>
                      <Input
                        value={ext.location || ""}
                        onChange={(e) => updateExtinguisher(idx, 'location', e.target.value)}
                        placeholder="e.g., Main Entrance"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Size/Type *</Label>
                        <Select
                          value={ext.size_type || ""}
                          onValueChange={(value) => updateExtinguisher(idx, 'size_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {sizeTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Manufacturer</Label>
                        <Select
                          value={ext.manufacturer || ""}
                          onValueChange={(value) => updateExtinguisher(idx, 'manufacturer', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {manufacturers.map(mfg => (
                              <SelectItem key={mfg} value={mfg}>{mfg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">UL Rating</Label>
                        <Input
                          value={ext.ul_rating || ""}
                          onChange={(e) => updateExtinguisher(idx, 'ul_rating', e.target.value)}
                          placeholder="2A:10B:C"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Service Completed</Label>
                        <div className="flex gap-2">
                          <Select
                            value={ext.service_completed || ""}
                            onValueChange={(value) => {
                              // preserve your original behavior + dirty flag
                              const updated = [...extinguishers];
                              updated[idx] = { ...updated[idx], service_completed: value };

                              // Auto-populate size_type if New is selected and size_type is empty
                              if (value === "New" && !updated[idx].size_type) {
                                updated[idx].size_type = '5lb ABC';
                                updated[idx].ul_rating = '2A:10B:C';

                                // if last_hydro already exists, recompute next_hydro based on new type
                                const interval = getHydroIntervalYears(updated[idx].size_type);
                                if (updated[idx].last_hydro) {
                                  updated[idx].next_hydro = calcNextHydroYY(updated[idx].last_hydro, interval);
                                }
                              }

                              setExtinguishers(updated);
                              setIsDirty(true);
                            }}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="6YR">6YR</SelectItem>
                              <SelectItem value="Hydro">Hydro</SelectItem>
                              <SelectItem value="Recharge">Recharge</SelectItem>
                              <SelectItem value="New">New</SelectItem>
                            </SelectContent>
                          </Select>
                          {ext.service_completed && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateExtinguisher(idx, 'service_completed', '')}
                              className="h-10 w-10 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={ext.status}
                        onValueChange={(value) => updateExtinguisher(idx, 'status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pass">Pass</SelectItem>
                          <SelectItem value="fail">Fail</SelectItem>
                          <SelectItem value="needs_service">Needs Service</SelectItem>
                          <SelectItem value="replaced">Replaced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">MFG Date</Label>
                        <Input
                          value={ext.mfg_date || ""}
                          onChange={(e) => updateExtinguisher(idx, 'mfg_date', e.target.value)}
                          placeholder="YY"
                          maxLength={2}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Last Hydro</Label>
                        <Input
                          value={ext.last_hydro || ""}
                          onChange={(e) => updateExtinguisher(idx, 'last_hydro', e.target.value)}
                          placeholder="YY"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">
                          Next Hydro{" "}
                          {ext.size_type ? (
                            <span className="text-slate-500">
                              ({getHydroIntervalYears(ext.size_type)}yr)
                            </span>
                          ) : null}
                        </Label>
                        <Input
                          value={ext.next_hydro || ""}
                          readOnly
                          placeholder="YY"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Last 6YR</Label>
                        <Input
                          value={ext.last_6yr || ""}
                          onChange={(e) => updateExtinguisher(idx, 'last_6yr', e.target.value)}
                          placeholder="YY"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Next 6YR</Label>
                      <Input
                        value={ext.next_6yr || ""}
                        onChange={(e) => updateExtinguisher(idx, 'next_6yr', e.target.value)}
                        placeholder="YY"
                        maxLength={2}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Comments</Label>
                      <Input
                        value={ext.comments || ""}
                        onChange={(e) => updateExtinguisher(idx, 'comments', e.target.value)}
                        placeholder="Notes..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {idx === array.length - 1 && (
                  <Button onClick={addExtinguisher} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Extinguisher
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {extinguishers.length > 0 && (
          <>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg print:hidden">
              <p className="text-sm text-slate-600 text-center">
                Total: <span className="font-semibold">{extinguishers.length}</span> extinguisher(s)
              </p>
            </div>

            <Card className="mt-6 print:hidden">
              <CardHeader>
                <CardTitle className="text-base">Customer Acknowledgment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
                <SignaturePad
                  label="Customer Signature"
                  value={customerSignature}
                  onChange={setCustomerSignature}
                />
                <p className="text-xs text-slate-500">
                  By signing above, the customer acknowledges the completion of the fire extinguisher survey.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Bottom Save Button */}
        <div className="no-print mt-6">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="lg"
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 relative overflow-hidden"
          >
            {isSaving && (
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 animate-pulse" />
            )}
            <span className="relative z-10 flex items-center">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Survey
                </>
              )}
            </span>
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6 print:hidden">
          NFPA 10 & Manufacturer Requirements
        </p>

        {/* Print Footer */}
        <div className="hidden print:block print-footer">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/321b7a425_FooterLogo.png"
            alt="NW Fire & Safety"
            className="print-footer-logo"
          />
          <div className="print-footer-text">
            <strong>Northwest Fire &amp; Safety, LLC</strong><br />
            2517 N Van Buren • Enid, OK 73703<br />
            (580) 540-3119 • www.nwfireandsafety.com
          </div>
        </div>

        {/* Exit Confirmation Dialog */}
        <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Are you sure you want to leave without saving?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay on Page</AlertDialogCancel>
              <AlertDialogAction onClick={() => navigate(createPageUrl("InspectionDetails") + `?id=${inspectionId}`)}>
                Leave Without Saving
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}