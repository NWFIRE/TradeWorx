import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { inspection_id } = await req.json();

        if (!inspection_id) {
            return Response.json({ error: 'inspection_id is required' }, { status: 400 });
        }

        // Fetch data
        const [inspections, fireAlarmReports, properties, clients] = await Promise.all([
            base44.entities.Inspection.list('-updated_date', 1000),
            base44.entities.FireAlarmReport.list('-updated_date', 1000),
            base44.entities.Property.list(),
            base44.entities.Client.list()
        ]);

        const inspection = inspections.find(i => i.id === inspection_id);
        if (!inspection) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }

        const fireAlarmReport = fireAlarmReports.find(r => r.inspection_id === inspection_id);
        const property = properties.find(p => p.id === inspection.property_id);
        const client = clients.find(c => c.id === inspection.client_id);

        if (!client) {
            return Response.json({ error: 'Client not found' }, { status: 404 });
        }

        // Build control panels table rows
        const controlPanelsRows = (fireAlarmReport?.control_panels || []).map(panel => `
        <tr>
          <td>${panel.manufacturer_model || '-'}</td>
          <td>${panel.line_voltage || '-'}</td>
          <td>${panel.battery_charge_level || '-'}</td>
          <td>${panel.battery_load_test || '-'}</td>
          <td>${panel.audible_visual_alarm || '-'}</td>
          <td>${panel.remote_monitoring || '-'}</td>
        </tr>`).join('');

        // Build input devices table rows
        const inputDevicesRows = (fireAlarmReport?.input_devices || []).map(device => `
        <tr>
          <td>${device.type || '-'}</td>
          <td>${device.operation_test || '-'}</td>
          <td>${device.circuit || '-'}</td>
          <td>${device.location || '-'}</td>
          <td>${device.sensitivity_setting || '-'}</td>
          <td>${device.remarks || '-'}</td>
        </tr>`).join('');

        // Build FACP photo section
        const facpPhotoHtml = fireAlarmReport?.control_panels?.[0]?.photo_url ? `
        <div class="section">
          <div class="card">
            <div class="card-title">Control Panel Photo</div>
            <img src="${fireAlarmReport.control_panels[0].photo_url}" style="max-width:100%; height:auto; border:1px solid var(--line); border-radius:4px" alt="Control Panel Photo">
          </div>
        </div>` : '';

        // Determine tag badge class
        const tagStatus = fireAlarmReport?.tag_status || 'Green Tag';
        const tagClass = tagStatus.includes('Green') ? 'badge-green' : 
                        tagStatus.includes('Red') ? 'badge-red' : 'badge-orange';

        const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png';

        // Build HTML
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Fire Alarm Inspection Report</title>

<style>
:root{
  --brand-blue:#0060B0;
  --brand-orange:#F06000;
  --text:#1a1a1a;
  --muted:#666;
  --line:#e9e9e9;
  --soft:#fafafa;
}

@page {
  size: Letter;
  margin: 0.5in;
}

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

/* Force Input Devices to new page */
.page-break{
  page-break-before:always;
  break-before:page;
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

@media print{
  .no-print{ display:none !important; }
}
</style>
</head>

<body>

<!-- HEADER -->
<div class="report-header">
  <div>
    <img class="logo" src="${logoUrl}" alt="NW Fire & Safety Logo">
  </div>

  <div>
    <div class="report-title">Fire Alarm Inspection Report</div>
    <div class="company-subtitle">
      580-540-3119 | 2517 N Van Buren, Enid, OK 73703<br>
      OK #AC441117, #466
    </div>
  </div>

  <div class="meta-block">
    <div><strong>Date:</strong> ${inspection.completed_date || inspection.scheduled_date || 'N/A'}</div>
    <div><strong>Inspector:</strong> ${fireAlarmReport?.inspector || inspection.inspector_name || 'N/A'}</div>
    <div><strong>Report #:</strong> ${inspection.id.slice(0, 8).toUpperCase()}</div>
  </div>
</div>

<div class="divider"></div>

<!-- CLIENT INFO -->
<div class="section">
  <div class="info-grid">
    <div class="info-item">
      <strong>Client</strong>
      <span>${client.company_name}</span>
    </div>
    <div class="info-item">
      <strong>Property</strong>
      <span>${property?.name || 'N/A'}</span>
    </div>
    <div class="info-item">
      <strong>Property Address</strong>
      <span>${property?.address || client.address || 'N/A'}</span>
    </div>
    <div class="info-item">
      <strong>Inspection Type</strong>
      <span>${fireAlarmReport?.type_of_inspection || 'N/A'}</span>
    </div>
    <div class="info-item">
      <strong>Tag Status</strong>
      <span class="badge ${tagClass}">${tagStatus}</span>
    </div>
  </div>
</div>

<!-- CONTROL PANELS -->
${fireAlarmReport?.control_panels?.length > 0 ? `<div class="section">
  <div class="card">
    <div class="card-title">Control Panels</div>
    <table>
      <thead>
        <tr>
          <th>Mfr/Model</th>
          <th>Voltage</th>
          <th>Battery Charge</th>
          <th>Load Test</th>
          <th>Alarm</th>
          <th>Monitoring</th>
        </tr>
      </thead>
      <tbody>
        ${controlPanelsRows}
      </tbody>
    </table>
  </div>
</div>` : ''}

<!-- FACP PHOTO -->
${facpPhotoHtml}

<!-- INPUT DEVICES -->
${inputDevicesRows ? `<div class="section">
  <div class="card">
    <div class="card-title">Input Devices</div>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Test</th>
          <th>Zone</th>
          <th>Location</th>
          <th>Sensitivity</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${inputDevicesRows}
      </tbody>
    </table>
  </div>
</div>` : ''}

<!-- SIGNATURES -->
<div class="section">
  <div class="card">
    <div class="card-title">Signatures</div>

    <div class="signature-row">
      <div class="signature-block">
        ${fireAlarmReport?.inspector_signature_url ? 
          `<img src="${fireAlarmReport.inspector_signature_url}" class="signature-image" alt="Inspector Signature" />` :
          '<div class="signature-line"></div>'}
        Inspector Signature<br>
        Date: ${inspection.completed_date || inspection.scheduled_date || '____________________'}
      </div>

      <div class="signature-block">
        ${fireAlarmReport?.client_signature_url ? 
          `<img src="${fireAlarmReport.client_signature_url}" class="signature-image" alt="Customer Signature" />` :
          '<div class="signature-line"></div>'}
        Customer Signature<br>
        Printed Name: ${fireAlarmReport?.client_name || client.contact_name || '____________________'}<br>
        Date: ____________________
      </div>
    </div>
  </div>
</div>

<div class="footer">
  Generated by NW FIRE Mobile | Fire Alarm Inspection Report
</div>

</body>
</html>`;

        return Response.json({ 
            success: true, 
            html_content: html,
            inspection_id: inspection_id
        });
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});