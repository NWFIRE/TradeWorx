import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { inspection_id } = await req.json();

        // Fetch the inspection
        const inspections = await base44.asServiceRole.entities.Inspection.filter({ id: inspection_id });
        const inspection = inspections[0];

        if (!inspection) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }

        // Only send notification for call-in inspections
        if (inspection.inspection_type !== 'call_in') {
            return Response.json({ message: 'Not a call-in inspection, skipping notification' });
        }

        // Get technician email
        let technicianEmail = null;
        if (inspection.inspector_id) {
            const users = await base44.asServiceRole.entities.User.filter({ id: inspection.inspector_id });
            if (users && users.length > 0) {
                technicianEmail = users[0].email;
            }
        }

        if (!technicianEmail) {
            return Response.json({ error: 'Technician email not found' }, { status: 400 });
        }

        // Get property and client details
        const properties = await base44.asServiceRole.entities.Property.filter({ id: inspection.property_id });
        const property = properties[0];
        
        const clients = await base44.asServiceRole.entities.Client.filter({ id: inspection.client_id });
        const client = clients[0];

        // Send email notification
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: technicianEmail,
            subject: `New Call-In Inspection Scheduled - ${property?.name || 'Property'}`,
            body: `
Hello ${inspection.inspector_name || 'Technician'},

You have been assigned to a new call-in inspection:

Property: ${property?.name || 'N/A'}
Address: ${property?.address || 'N/A'}
Client: ${client?.company_name || 'N/A'}
Scheduled Date: ${inspection.scheduled_date || 'N/A'}
Scheduled Time: ${inspection.scheduled_time || 'N/A'}

${inspection.notes ? `Notes: ${inspection.notes}` : ''}

Please log in to the system to view full details.

Thank you,
NW FIRE Mobile Team
            `
        });

        return Response.json({ 
            success: true, 
            message: 'Notification sent to technician',
            technician_email: technicianEmail
        });

    } catch (error) {
        console.error('Error sending notification:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});