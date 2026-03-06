import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
        }

        // Get all inspections
        const inspections = await base44.asServiceRole.entities.Inspection.list();
        
        let created = 0;
        let skipped = 0;

        for (const inspection of inspections) {
            if (!inspection.deficiencies || inspection.deficiencies.length === 0) {
                continue;
            }

            // Get existing deficiency entities for this inspection
            const existingDeficiencies = await base44.asServiceRole.entities.Deficiency.filter({
                inspection_id: inspection.id
            });

            for (const def of inspection.deficiencies) {
                // Check if this specific deficiency already exists
                const exists = existingDeficiencies.some(
                    existing => existing.description === def.description && existing.location === def.location
                );

                if (!exists && def.description) {
                    // Map severity from old format to new format
                    let severity = 'medium';
                    if (def.severity === 'minor') severity = 'low';
                    else if (def.severity === 'moderate') severity = 'medium';
                    else if (def.severity === 'major') severity = 'high';
                    else if (def.severity === 'critical') severity = 'critical';

                    await base44.asServiceRole.entities.Deficiency.create({
                        inspection_id: inspection.id,
                        property_id: inspection.property_id,
                        client_id: inspection.client_id,
                        description: def.description,
                        severity: severity,
                        location: def.location || "",
                        corrective_action: def.corrective_action || "",
                        due_date: def.due_date || null,
                        status: "open"
                    });
                    created++;
                } else {
                    skipped++;
                }
            }
        }

        return Response.json({
            success: true,
            message: `Synced deficiencies: ${created} created, ${skipped} skipped`,
            created,
            skipped
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});