import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { inspection_id } = await req.json();

        // Fetch inspection data
        const inspection = await base44.entities.Inspection.list('-updated_date', 1000);
        const inspectionData = inspection.find(i => i.id === inspection_id);

        if (!inspectionData) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }

        // Only process completed inspections
        if (inspectionData.status !== 'completed') {
            return Response.json({ success: false, message: 'Inspection not completed' });
        }

        // Fetch related data
        const [properties, clients, fireAlarmReports, fireExtinguishers, emergencyLightReports] = await Promise.all([
            base44.entities.Property.list(),
            base44.entities.Client.list(),
            base44.entities.FireAlarmReport.list(),
            base44.entities.FireExtinguisher.list(),
            base44.entities.EmergencyLightReport.list()
        ]);

        const property = properties.find(p => p.id === inspectionData.property_id);
        const client = clients.find(c => c.id === inspectionData.client_id);

        if (!client || !property) {
            return Response.json({ error: 'Client or property not found' }, { status: 404 });
        }

        // Gather report summaries
        let reportSummary = 'Inspection Reports:\n';
        if (inspectionData.report_types?.includes('fire_alarm')) {
            const fireAlarmReport = fireAlarmReports.find(r => r.inspection_id === inspection_id);
            if (fireAlarmReport) {
                reportSummary += `- Fire Alarm: Tag Status - ${fireAlarmReport.tag_status}\n`;
            }
        }
        if (inspectionData.report_types?.includes('fire_extinguisher')) {
            const extinguishers = fireExtinguishers.filter(e => e.inspection_id === inspection_id);
            reportSummary += `- Fire Extinguishers: ${extinguishers.length} units inspected\n`;
        }
        if (inspectionData.report_types?.includes('emergency_lighting')) {
            const emergencyLights = emergencyLightReports.filter(e => e.inspection_id === inspection_id);
            if (emergencyLights.length > 0) {
                reportSummary += `- Emergency Lighting: ${emergencyLights[0].overall_status}\n`;
            }
        }

        // Use AI to summarize findings
        let aiSummary = '';
        if (inspectionData.notes) {
            try {
                const aiResponse = await base44.integrations.Core.InvokeLLM({
                    prompt: `Summarize the key findings and issues from these inspection notes. Be concise and highlight any critical deficiencies:\n\n${inspectionData.notes}`,
                    add_context_from_internet: false,
                    response_json_schema: {
                        type: 'object',
                        properties: {
                            summary: { type: 'string' },
                            critical_issues: { type: 'array', items: { type: 'string' } }
                        }
                    }
                });
                aiSummary = aiResponse.summary;
            } catch (aiError) {
                console.error('AI summarization failed:', aiError);
            }
        }

        // Generate PDF
        const doc = new jsPDF();
        let yPosition = 20;
        const pageHeight = doc.internal.pageSize.height;
        const footerHeight = 30;
        const maxContentY = pageHeight - footerHeight - 10;

        // Footer function
        const addPageFooter = () => {
            const footerY = pageHeight - 20;
            
            // Add logo
            const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/321b7a425_FooterLogo.png';
            doc.addImage(logoUrl, 'PNG', 20, footerY - 8, 45, 11);
            
            // Add footer text
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Northwest Fire & Safety, LLC', 105, footerY - 3, { align: 'center' });
            doc.setFont(undefined, 'normal');
            doc.text('2517 N Van Buren • Enid, OK 73703', 105, footerY + 2, { align: 'center' });
            doc.text('(580) 540-3119 • www.nwfireandsafety.com', 105, footerY + 7, { align: 'center' });
        };

        // Header
        doc.setFontSize(18);
        doc.text('Fire Safety Inspection Report', 20, yPosition);
        yPosition += 15;

        // Client and Property Info
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Inspection Details', 20, yPosition);
        yPosition += 8;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const details = [
            `Client: ${client.company_name}`,
            `Property: ${property.name}`,
            `Address: ${property.address}`,
            `Inspection Date: ${inspectionData.completed_date || inspectionData.scheduled_date}`,
            `Inspector: ${inspectionData.inspector_name}`,
            `Status: ${inspectionData.status}`
        ];

        details.forEach(detail => {
            doc.text(detail, 20, yPosition);
            yPosition += 7;
        });

        yPosition += 5;

        // Report Summary
        doc.setFont(undefined, 'bold');
        doc.text('Report Summary', 20, yPosition);
        yPosition += 8;

        doc.setFont(undefined, 'normal');
        const splitSummary = doc.splitTextToSize(reportSummary, 170);
        doc.text(splitSummary, 20, yPosition);
        yPosition += splitSummary.length * 5 + 5;

        // AI Summary
        if (aiSummary) {
            if (yPosition > maxContentY) {
                addPageFooter();
                doc.addPage();
                yPosition = 20;
            }

            doc.setFont(undefined, 'bold');
            doc.text('Key Findings Summary', 20, yPosition);
            yPosition += 8;

            doc.setFont(undefined, 'normal');
            const splitAISummary = doc.splitTextToSize(aiSummary, 170);
            doc.text(splitAISummary, 20, yPosition);
            yPosition += splitAISummary.length * 5 + 5;
        }

        // Signature Section
        if (client.contact_name || inspectionData.signature_url) {
            // Check if enough space for signature section
            if (yPosition + 25 > maxContentY) {
                addPageFooter();
                doc.addPage();
                yPosition = 20;
            }

            yPosition += 5;

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text('Customer Name:', 20, yPosition);
            doc.setFont(undefined, 'normal');
            doc.text(client.contact_name || 'N/A', 60, yPosition);

            yPosition += 6;

            if (inspectionData.signature_url) {
                try {
                    const signatureImgWidth = 40;
                    const signatureImgHeight = 15;
                    doc.addImage(inspectionData.signature_url, 'PNG', 20, yPosition, signatureImgWidth, signatureImgHeight);
                    yPosition += signatureImgHeight + 2;
                } catch (imgError) {
                    console.error('Failed to add signature image:', imgError);
                    doc.line(20, yPosition + 2, 80, yPosition + 2);
                    yPosition += 8;
                }
            } else {
                doc.line(20, yPosition + 2, 80, yPosition + 2);
                yPosition += 8;
            }

            doc.setFontSize(7);
            doc.text('Signature', 20, yPosition);
        }

        // Add footer to final page
        addPageFooter();

        const pdfBytes = doc.output('arraybuffer');

        // Upload PDF to storage
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const uploadedFile = await base44.integrations.Core.UploadFile({ file: pdfBlob });
        const pdfFileUrl = uploadedFile.file_url;

        // Send email with PDF link
        const emailSubject = `Fire Safety Inspection Report - ${property.name}`;
        const emailBody = `Dear ${client.contact_name || client.company_name},

Please find attached the fire safety inspection report for ${property.name} completed on ${inspectionData.completed_date || inspectionData.scheduled_date}.

${aiSummary ? `Key Findings:\n${aiSummary}\n\n` : ''}You can view the full report here: ${pdfFileUrl}

If you have any questions regarding this inspection, please contact us.

Best regards,
Fire Safety Inspection Team`;

        try {
            await base44.integrations.Core.SendEmail({
                to: client.email,
                subject: emailSubject,
                body: emailBody
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        return Response.json({ 
            success: true, 
            message: 'Report generated and email sent',
            inspection_id: inspection_id,
            pdf_url: pdfFileUrl
        });
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});