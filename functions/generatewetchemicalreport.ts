import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { inspection_id } = await req.json();

        if (!inspection_id) {
            return Response.json({ error: 'inspection_id is required' }, { status: 400 });
        }

        // Fetch inspection data
        const inspections = await base44.entities.Inspection.filter({ id: inspection_id });
        const inspection = inspections[0];

        if (!inspection) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }

        // Fetch wet chemical report
        const reports = await base44.entities.WetChemicalSystemReport.filter({ 
            inspection_id: inspection_id 
        });
        const report = reports[0];

        if (!report) {
            return Response.json({ error: 'Wet chemical report not found' }, { status: 404 });
        }

        // Fetch property and client
        let property = null;
        if (inspection.property_id) {
            const properties = await base44.entities.Property.filter({ id: inspection.property_id });
            property = properties[0];
        }

        let client = null;
        if (inspection.client_id) {
            const clients = await base44.entities.Client.filter({ id: inspection.client_id });
            client = clients[0];
        }

        // Format date
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A';
            const date = new Date(dateStr);
            return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
        };

        // Badge class helper
        const getBadgeClass = (status) => {
            if (status === 'Green Tag') return 'badge-green';
            if (status === 'Red Tag') return 'badge-red';
            return 'badge-orange';
        };

        // Build hoods/appliances table
        let appliancesHTML = '';
        if (report.hoods?.some(h => h.appliances?.length > 0)) {
            appliancesHTML = `
                <div class="section">
                    <div class="card">
                        <div class="card-title">Cooking Appliances</div>
                        <table>
                            <tbody>
                                ${report.hoods.map(hood => {
                                    if (!hood.appliances?.length) return '';
                                    return `
                                        <tr>
                                            <th colspan="3" style="text-align:left">${hood.hood_name || 'Hood'}</th>
                                        </tr>
                                        <tr>
                                            <th>Appliance</th>
                                            <th>Size</th>
                                            <th>Nozzle(s)</th>
                                        </tr>
                                        ${hood.appliances.map(app => `
                                            <tr>
                                                <td style="width:33%">${app.appliance || '-'}</td>
                                                <td style="width:33%">${app.size || '-'}</td>
                                                <td style="width:33%">${app.nozzles || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Build checklist
        const checklistItems = [
            { key: 'appliances_protected', label: 'All appliances properly protected' },
            { key: 'duct_plenum_protected', label: 'Duct & plenum protected' },
            { key: 'nozzles_positioned', label: 'Nozzles positioned correctly' },
            { key: 'system_installed_properly', label: 'System installed per listing' },
            { key: 'hood_duct_sealed', label: 'Hood & duct sealed' },
            { key: 'pressure_gauge_ok', label: 'Pressure gauge OK' },
            { key: 'cartridge_weight_ok', label: 'Cartridge weight OK' },
            { key: 'cylinder_chemical_ok', label: 'Cylinder/chemical level OK' },
            { key: 'operated_manual', label: 'Operated manually' },
            { key: 'operated_test_link', label: 'Operated with test link' },
            { key: 'fuel_source_shutdown', label: 'Fuel source shutdown' },
            { key: 'nozzles_clean', label: 'Nozzles clean' },
            { key: 'detection_links_placed', label: 'Detection links placed' },
            { key: 'fusible_links_replaced', label: 'Fusible links replaced' },
            { key: 'cable_travel_checked', label: 'Cable travel checked' },
            { key: 'piping_secure', label: 'Piping secure' },
            { key: 'flame_fryer_separation', label: 'Flame/fryer separation OK' },
            { key: 'fire_alarm_working', label: 'Fire alarm working' },
            { key: 'gas_valve_tested', label: 'Gas valve tested' },
            { key: 'piping_obstruction_test', label: 'Piping obstruction test' },
            { key: 'filters_installed', label: 'Filters installed' },
            { key: 'exhaust_fan_ok', label: 'Exhaust fan OK' },
            { key: 'extinguisher_charged', label: 'K-Class extinguisher charged' },
            { key: 'hood_cleaned_regularly', label: 'Hood cleaned regularly' }
        ];

        const checklistHTML = `
            <div class="section">
                <div class="card">
                    <div class="card-title">Inspection Checklist</div>
                    <table>
                        <tbody>
                            ${checklistItems.map((item, idx) => `
                                <tr>
                                    <td style="width:70%">${idx + 1}. ${item.label}</td>
                                    <td style="width:30%; text-align:center"><strong>${report.checklist?.[item.key] || 'N/A'}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Build photos section
        let photosHTML = '';
        if (report.system_photos?.length > 0) {
            photosHTML = `
                <div class="section">
                    <div class="card">
                        <div class="card-title">System Photos</div>
                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:8px">
                            ${report.system_photos.map((url, idx) => `
                                <img src="${url}" alt="System photo ${idx + 1}" 
                                    style="max-width:100%; height:auto; border:1px solid var(--line); border-radius:4px" />
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Build comments section
        let commentsHTML = '';
        if (report.comments_deficiencies) {
            commentsHTML = `
                <div class="section">
                    <div class="card">
                        <div class="card-title">Comments / Deficiencies</div>
                        <div style="font-size:11px; white-space:pre-wrap">${report.comments_deficiencies}</div>
                    </div>
                </div>
            `;
        }

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Wet Chemical Kitchen Suppression Report</title>
    <style>
        :root{
          --brand-blue:#0060B0;
          --brand-orange:#F06000;
          --text:#1a1a1a;
          --muted:#666;
          --line:#e9e9e9;
          --soft:#fafafa;
        }

        @page { margin: 0.5in; }
        
        body{
          font-family:"Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size:12px;
          color:var(--text);
          margin:0;
        }
        
        .report-header{
          display:grid;
          grid-template-columns:180px 1fr 240px;
          align-items:start;
          column-gap:16px;
        }
        
        .logo{
          max-height:90px;
          width:auto;
          display:block;
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
          margin-bottom:22px;
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
        
        .badge{
          display:inline-block;
          padding:2px 8px;
          border-radius:999px;
          font-size:11px;
          font-weight:700;
          border:1px solid var(--line);
          background:#fff;
        }
        .badge-green{ color:#2e7d32; border-color:#cfe8d4; background:#f4fbf6; }
        .badge-red{ color:#c62828; border-color:#f0c8c8; background:#fff6f6; }
        .badge-orange{ color:var(--brand-orange); border-color:#ffd9c4; background:#fff7f2; }
        
        .card{
          border:1px solid var(--line);
          border-radius:10px;
          padding:14px;
          background:white;
          page-break-inside:avoid;
        }
        
        .card-title{
          font-weight:800;
          color:var(--brand-blue);
          margin-bottom:8px;
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
        
        .signature-row{
          display:flex;
          justify-content:space-between;
          margin-top:20px;
        }
        
        .signature-block{
          width:48%;
        }
        
        .signature-line{
          border-bottom:1px solid #000;
          height:40px;
          margin-bottom:6px;
        }
        
        .signature-image{
          height:40px;
          margin-bottom:6px;
        }
        
        .footer{
          margin-top:30px;
          font-size:10px;
          text-align:center;
          color:#888;
        }
    </style>
</head>
<body>
    <div class="report-header">
        <div>
            <img class="logo" src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png" alt="NW Fire & Safety Logo" />
        </div>

        <div>
            <div class="report-title">Wet Chemical Kitchen Suppression Report</div>
            <div class="company-subtitle">
                580-540-3119 | 2517 N Van Buren, Enid, OK 73703<br />
                OK #AC441117, #466
            </div>
        </div>

        <div class="meta-block">
            <div><strong>Date:</strong> ${formatDate(report.service_date)}</div>
            <div><strong>Technician:</strong> ${report.technician_name || 'N/A'}</div>
            <div><strong>Report #:</strong> ${inspection_id.slice(0, 8).toUpperCase()}</div>
        </div>
    </div>

    <div class="divider"></div>

    <div class="section">
        <div class="info-grid">
            <div class="info-item">
                <strong>Client</strong>
                <span>${client?.company_name || 'N/A'}</span>
            </div>
            <div class="info-item">
                <strong>Property</strong>
                <span>${property?.name || 'N/A'}</span>
            </div>
            <div class="info-item">
                <strong>Property Address</strong>
                <span>${property?.address || client?.address || 'N/A'}</span>
            </div>
            <div class="info-item">
                <strong>Inspection Type</strong>
                <span>${report.type_of_service || 'N/A'}</span>
            </div>
            <div class="info-item">
                <strong>System Status</strong>
                <span class="badge ${getBadgeClass(report.system_status)}">${report.system_status || 'N/A'}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="card">
            <div class="card-title">System Details</div>
            <table>
                <tbody>
                    <tr>
                        <td style="width:25%"><strong>Size (Gal):</strong></td>
                        <td style="width:25%">${report.system_size_gallons || '-'}</td>
                        <td style="width:25%"><strong># Cylinders:</strong></td>
                        <td style="width:25%">${report.num_cylinders || '-'}</td>
                    </tr>
                    <tr>
                        <td><strong>Manufacturer:</strong></td>
                        <td>${report.manufacturer || '-'}</td>
                        <td><strong>Model:</strong></td>
                        <td>${report.model || '-'}</td>
                    </tr>
                    <tr>
                        <td><strong>Location:</strong></td>
                        <td>${report.system_location || '-'}</td>
                        <td><strong>Area Protected:</strong></td>
                        <td>${report.area_protected || '-'}</td>
                    </tr>
                    <tr>
                        <td><strong>Last Hydro:</strong></td>
                        <td>${report.last_cylinder_hydro_date || '-'}</td>
                        <td><strong>Gas Valve:</strong></td>
                        <td>${report.type_of_gas_valve || ''} - ${report.size_of_gas_valve || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    ${appliancesHTML}

    ${checklistHTML}

    <div class="section">
        <div class="card">
            <div class="card-title">Additional Details</div>
            <table>
                <tbody>
                    <tr>
                        <td style="width:25%"><strong>Fusible Links:</strong></td>
                        <td style="width:25%">${Array.isArray(report.fusible_links_used) ? report.fusible_links_used.map(l => `${l.quantity}x ${l.temperature}`).join(', ') : (report.fusible_links_used || '-')}</td>
                        <td style="width:25%"><strong>Caps Used:</strong></td>
                        <td style="width:25%">${report.blow_off_caps_qty > 0 ? `${report.blow_off_caps_qty}x ${report.blow_off_caps_type || ''}`.trim() : (report.blow_off_caps_used || '-')}</td>
                    </tr>
                    <tr>
                        <td><strong>Hood Size:</strong></td>
                        <td>${report.hood_size || '-'}</td>
                        <td><strong># Ducts:</strong></td>
                        <td>${report.num_ducts || '-'}</td>
                    </tr>
                    <tr>
                        <td><strong>Duct Size:</strong></td>
                        <td>${report.duct_sizes_nozzles || '-'}</td>
                        <td><strong>Duct Nozzle Type & Qty:</strong></td>
                        <td>${report.duct_nozzle_type || '-'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    ${commentsHTML}

    ${photosHTML}

    <div class="section">
        <div class="card">
            <div class="card-title">Signatures</div>
            
            <div class="signature-row">
                <div class="signature-block">
                    ${report.customer_signature_url ? 
                        `<img src="${report.customer_signature_url}" class="signature-image" alt="Customer Signature" />` :
                        '<div class="signature-line"></div>'}
                    Customer Signature<br />
                    Printed Name: ${report.customer_name || '____________________'}<br />
                    Date: ____________________
                </div>

                <div class="signature-block">
                    <div class="signature-line"></div>
                    Technician Signature<br />
                    Printed Name: ${report.technician_name || '____________________'}<br />
                    License #: ${report.technician_license || '____________________'}
                </div>
            </div>
        </div>
    </div>

    <div class="footer">
        Generated by NW FIRE Mobile | NFPA 17A Compliant Report
    </div>
</body>
</html>
        `;

        return Response.json({ html });

    } catch (error) {
        console.error('Error generating wet chemical report:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});