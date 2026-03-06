import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import moment from 'npm:moment';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get the current month and calculate the next month
        const now = moment();
        const nextMonth = now.clone().add(1, 'month');
        const nextMonthFormatted = nextMonth.format('YYYY-MM');

        // Fetch all inspections scheduled for next month
        const inspections = await base44.asServiceRole.entities.Inspection.filter({
            scheduled_date: { $regex: `^${nextMonthFormatted}` }
        }, 'client_id', 1000);

        if (inspections.length === 0) {
            console.log('No inspections scheduled for next month. No reminders sent.');
            return Response.json({ message: 'No inspections for next month' }, { status: 200 });
        }

        // Group inspections by client
        const clientInspections = {};
        for (const inspection of inspections) {
            if (!clientInspections[inspection.client_id]) {
                clientInspections[inspection.client_id] = [];
            }
            clientInspections[inspection.client_id].push(inspection);
        }

        // Send one email per client with all their upcoming inspections
        let emailsSent = 0;
        for (const clientId in clientInspections) {
            const client = await base44.asServiceRole.entities.Client.get(clientId);
            if (!client || !client.email) {
                console.warn(`Client with ID ${clientId} not found or has no email. Skipping reminder.`);
                continue;
            }

            let emailBody = `<div style="text-align: center; margin-bottom: 30px;">
    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/2014ca4e0_IMG_5002.png" alt="NW FIRE & SAFETY" style="max-width: 300px; height: auto;" />
</div>

<p>Dear ${client.company_name},</p>

<p>This is a friendly reminder of your upcoming fire and life safety services scheduled for next month.</p>

<p><strong>Here are the details for your upcoming inspections:</strong></p>

<ul>`;

            for (const inspection of clientInspections[clientId]) {
                const scheduledDate = inspection.scheduled_date.length === 7
                    ? moment(inspection.scheduled_date, 'YYYY-MM').format('MMMM YYYY')
                    : moment(inspection.scheduled_date).format('MMMM D, YYYY');
                
                const reportTypes = inspection.report_types?.map(type => 
                    type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                ).join(', ') || 'N/A';
                
                emailBody += `<li><strong>Scheduled For:</strong> ${scheduledDate}<br>`;
                emailBody += `<strong>Services:</strong> ${reportTypes}</li>`;
            }

            emailBody += `</ul>

<p>We will be in touch shortly to confirm the exact date and time. Please feel free to reach out if you have any questions.</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;">

<div style="text-align: center; color: #666;">
    <p style="margin: 5px 0;">580-540-3119 | 2517 N Van Buren, Enid, OK 73703</p>
    <p style="margin: 5px 0;">OK #AC441117, #466</p>
</div>`;

            await base44.integrations.Core.SendEmail({
                to: client.email,
                subject: `Upcoming Fire Safety Inspection Reminder - ${nextMonth.format('MMMM YYYY')}`,
                body: emailBody,
            });
            
            emailsSent++;
            console.log(`Reminder email sent to ${client.email} for ${clientInspections[clientId].length} upcoming inspection(s).`);
        }

        return Response.json({ 
            message: 'Monthly inspection reminders sent successfully',
            emailsSent,
            inspectionsCount: inspections.length
        }, { status: 200 });
    } catch (error) {
        console.error('Error sending monthly inspection reminders:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});