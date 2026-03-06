// Report type configurations
export const reportTypeConfig = {
    fire_alarm: {
        label: "Fire Alarm System",
        icon: "Bell",
        color: "bg-[#FF000D]",
        categories: []
    },
    sprinkler_system: {
        label: "Sprinkler System",
        icon: "Droplets",
        color: "bg-[#B0E0E6]",
        categories: []
    },
    fire_extinguisher: {
        label: "Fire Extinguisher",
        icon: "Flame",
        color: "bg-[#FF7F00]",
        categories: []
    },
    emergency_lighting: {
        label: "Emergency Lighting",
        icon: "Lightbulb",
        color: "bg-[#DDB022]",
        categories: []
    },
    fire_door: {
        label: "Fire Door",
        icon: "DoorClosed",
        color: "bg-purple-500",
        categories: []
    },
    kitchen_suppression: {
        label: "Kitchen Suppression",
        icon: "ChefHat",
        color: "bg-blue-500",
        categories: []
    },
    fire_pump: {
        label: "Fire Pump",
        icon: "Activity",
        color: "bg-teal-500",
        categories: []
    },
    work_order: {
        label: "Work Order",
        icon: "ClipboardCheck",
        color: "bg-slate-500",
        categories: []
    },
    pdf_upload: {
        label: "PDF Upload",
        icon: "FileText",
        color: "bg-slate-500",
        categories: []
    },
    comprehensive: {
        label: "Comprehensive Inspection",
        icon: "ClipboardCheck",
        color: "bg-slate-700",
        categories: []
    }
};

export const getChecklistForReportType = (reportType) => {
    const config = reportTypeConfig[reportType] || reportTypeConfig.comprehensive;
    return config.categories.flatMap(cat =>
        cat.items.map(item => ({
            category: cat.name,
            item: item,
            status: "pending",
            notes: ""
        }))
    );
};

export default reportTypeConfig;