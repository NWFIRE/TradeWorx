import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { inspection_id } = await req.json();

        if (!inspection_id) {
            return Response.json({ error: 'inspection_id is required' }, { status: 400 });
        }

        // Fetch inspection data
        const inspections = await base44.entities.Inspection.list('-updated_date', 1000);
        const inspection = inspections.find(i => i.id === inspection_id);

        if (!inspection) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }

        // Fetch related data
        const [properties, clients, extinguishers] = await Promise.all([
            base44.entities.Property.list(),
            base44.entities.Client.list(),
            base44.entities.FireExtinguisher.list()
        ]);

        const property = properties.find(p => p.id === inspection.property_id);
        const client = clients.find(c => c.id === inspection.client_id);
        const inspectionExtinguishers = extinguishers.filter(e => e.inspection_id === inspection_id);

        if (!client) {
            return Response.json({ error: 'Client not found' }, { status: 404 });
        }

        // Sort extinguishers by number
        const sortedExtinguishers = inspectionExtinguishers.sort((a, b) => (a.number || 0) - (b.number || 0));

        // Deduplicate by number - keep most recent (last in array after sort)
        const uniqueExtinguishers = [];
        const seenNumbers = new Set();
        for (let i = sortedExtinguishers.length - 1; i >= 0; i--) {
            const ext = sortedExtinguishers[i];
            if (!seenNumbers.has(ext.number)) {
                uniqueExtinguishers.unshift(ext);
                seenNumbers.add(ext.number);
            }
        }

        // Calculate summary
        const totalUnits = uniqueExtinguishers.length;
        const unitsPassed = uniqueExtinguishers.filter(e => e.status === 'pass').length;
        const unitsFailed = uniqueExtinguishers.filter(e => e.status === 'fail').length;
        const unitsService = uniqueExtinguishers.filter(e => e.status === 'needs_service').length;

        // Generate extinguisher rows HTML
        const extinguisherRows = uniqueExtinguishers.map(ext => {
            const statusClass = ext.status === 'pass' ? 'status-pass' : 
                               ext.status === 'fail' ? 'status-fail' : 'status-service';
            const statusText = ext.status === 'pass' ? 'Pass' : 
                              ext.status === 'fail' ? 'Fail' : 'Service Required';

            return `
        <tr>
        <td>${ext.number || 'N/A'}</td>
        <td>${ext.location || 'N/A'}</td>
        <td>${ext.size_type || 'N/A'}</td>
        <td>${ext.ul_rating || 'N/A'}</td>
        <td>${ext.mfg_date || 'N/A'}</td>
        <td>${ext.next_6yr || ext.next_hydro || 'N/A'}</td>
        <td class="${statusClass}">${statusText}</td>
        </tr>`;
        }).join('');

        const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png';

        // Build HTML report
        const html = `<!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <title>Fire Extinguisher Inspection Report</title>

        <style>
        :root{
        --brand-blue:#0060B0;
        --brand-orange:#F06000;
        --text:#1a1a1a;
        --muted:#666;
        --line:#e9e9e9;
        }

        @page {
        size: Letter;
        margin: 0.5in;
        }

        body{
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        font-size: 12px;
        color: var(--text);
        margin:0;
        }

        .report-header{
        display:grid;
        grid-template-columns:180px 1fr 220px;
        align-items:start;
        column-gap:16px;
        }

        .logo{
          max-height:90px;
          width:auto;
        }

        .report-title{
        text-align:center;
        font-size:22px;
        font-weight:800;
        color:var(--brand-blue);
        margin-top:10px;
        }

        .company-subtitle{
        text-align:center;
        font-size:11px;
        color:var(--muted);
        margin-top:6px;
        }

        .meta-block{
        text-align:right;
        font-size:11px;
        line-height:1.6;
        }

        .divider{
        height:3px;
        background:var(--brand-orange);
        border-radius:3px;
        margin:18px 0 24px;
        }

        .section{
        margin-bottom:28px;
        }

        .info-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px 40px;
        }

        .info-item strong{
        display:block;
        font-size:11px;
        text-transform:uppercase;
        color:var(--brand-blue);
        letter-spacing:.5px;
        }

        table{
        width:100%;
        border-collapse:collapse;
        }

        thead{
        display:table-header-group;
        border-bottom:2px solid var(--brand-blue);
        }

        th{
        text-align:left;
        padding:10px 6px;
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.5px;
        color:var(--brand-blue);
        }

        td{
        padding:8px 6px;
        border-bottom:1px solid var(--line);
        font-size:11px;
        }

        tr{
        page-break-inside:avoid;
        break-inside:avoid;
        }

        .status-pass{
        color:#2e7d32;
        font-weight:700;
        }

        .status-fail{
        color:#c62828;
        font-weight:700;
        }

        .status-service{
        color:var(--brand-orange);
        font-weight:700;
        }

        .summary-box{
        margin-top:20px;
        padding:14px;
        border:1px solid var(--line);
        background:#fafafa;
        page-break-inside:avoid;
        }

        .summary-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        text-align:center;
        margin-top:10px;
        }

        .summary-grid strong{
        font-size:18px;
        display:block;
        color:var(--brand-blue);
        }

        .certification{
        margin-top:40px;
        page-break-inside:avoid;
        }

        .signature-row{
        display:flex;
        justify-content:space-between;
        margin-top:30px;
        }

        .signature-block{
        width:48%;
        }

        .signature-line{
        border-bottom:1px solid #000;
        height:30px;
        margin-bottom:6px;
        }

        .signature-image{
        height:50px;
        margin-bottom:6px;
        }

        .footer{
        margin-top:40px;
        font-size:10px;
        text-align:center;
        color:#888;
        }

        @media print{
        .no-print{ display:none !important; }
        }
        </style>
        </head>

        <body>

        <div class="report-header">
        <div>
        <img class="logo" src="${logoUrl}" alt="NW Fire & Safety Logo">
        </div>

        <div>
        <div class="report-title">Fire Extinguisher Inspection Report</div>
        <div class="company-subtitle">
        580-540-3119 | 2517 N Van Buren, Enid, OK 73703<br>
        OK #AC441117, #466
        </div>
        </div>

        <div class="meta-block">
        <div><strong>Date:</strong> ${inspection.completed_date || inspection.scheduled_date}</div>
        <div><strong>Technician:</strong> ${inspection.inspector_name || 'N/A'}</div>
        <div><strong>Report #:</strong> ${inspection.id.slice(0, 8).toUpperCase()}</div>
        </div>
        </div>

        <div class="divider"></div>

        <div class="section">
        <div class="info-grid">
        <div class="info-item">
        <strong>Client</strong>
        <span>${client.company_name}</span>
        </div>
        <div class="info-item">
        <strong>Property Address</strong>
        <span>${property?.address || client.address || 'N/A'}</span>
        </div>
        <div class="info-item">
        <strong>Property Name</strong>
        <span>${property?.name || inspection.property_name || 'N/A'}</span>
        </div>
        <div class="info-item">
        <strong>Inspection Type</strong>
        <span>Annual NFPA 10 Inspection</span>
        </div>
        </div>
        </div>

        <div class="section">
        <h3 style="color:var(--brand-blue)">Extinguisher Inventory</h3>

        <table>
        <thead>
        <tr>
        <th>#</th>
        <th>Location</th>
        <th>Size/Type</th>
        <th>UL Rating</th>
        <th>MFG</th>
        <th>Next Service</th>
        <th>Status</th>
        </tr>
        </thead>
        <tbody>
        ${extinguisherRows}
        </tbody>
        </table>
        </div>

        <div class="summary-box">
        <strong>Inspection Summary</strong>
        <div class="summary-grid">
        <div>
        <strong>${totalUnits}</strong>
        Total Units
        </div>
        <div>
        <strong>${unitsPassed}</strong>
        Passed
        </div>
        <div>
        <strong>${unitsFailed}</strong>
        Failed
        </div>
        <div>
        <strong>${unitsService}</strong>
        Service Required
        </div>
        </div>
        </div>

        <div class="certification">
        <p>
        I certify that the fire extinguishers listed above were inspected in accordance
        with NFPA 10 standards and applicable manufacturer requirements.
        </p>

        <div class="signature-row">
        <div class="signature-block">
        ${inspection.signature_url ? 
        `<img src="${inspection.signature_url}" class="signature-image" alt="Technician Signature" />` : 
        '<div class="signature-line"></div>'}
        Technician Signature<br>
        Date: ${inspection.completed_date || inspection.scheduled_date || '____________________'}
        </div>

        <div class="signature-block">
        <div class="signature-line"></div>
        Customer Signature<br>
        Printed Name: ${client.contact_name || '____________________'}<br>
        Date: ____________________
        </div>
        </div>
        </div>

        <div class="footer">
        Generated by NW FIRE Mobile | NFPA 10 Compliant Report
        </div>

        </body>
        </html>`;

        return Response.json({ 
            success: true, 
            html_content: html,
            inspection_id: inspection_id,
            summary: {
                total_units: totalUnits,
                units_passed: unitsPassed,
                units_failed: unitsFailed,
                units_service: unitsService
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});