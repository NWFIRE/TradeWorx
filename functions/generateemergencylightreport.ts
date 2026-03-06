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

        // Fetch emergency light report
        const reports = await base44.entities.EmergencyLightReport.filter({ 
            inspection_id: inspection_id 
        });
        const report = reports[0];

        if (!report) {
            return Response.json({ error: 'Emergency Light Report not found' }, { status: 404 });
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
        const getStatusClass = (status) => {
            if (status === 'Pass') return 'pass';
            if (status === 'Fail') return 'fail';
            return 'na';
        };

        // Build emergency lights table rows
        const lightsRows = (report.light_locations || []).map((light, index) => {
            return `
          <tr>
            <td>${index + 1}</td>
            <td>${light.location || '-'}</td>
            <td>${light.type || '-'}</td>
            <td>
              <span class="status-badge badge-${getStatusClass(light.pass_fail)}">
                ${light.pass_fail || 'N/A'}
              </span>
            </td>
            <td>${light.notes || '-'}</td>
          </tr>`;
        }).join('');

        // Calculate summary
        const totalUnits = report.light_locations?.length || 0;
        const passCount = report.light_locations?.filter(l => l.pass_fail === 'Pass').length || 0;
        const failCount = report.light_locations?.filter(l => l.pass_fail === 'Fail').length || 0;
        const naCount = totalUnits - passCount - failCount;

        const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Emergency Lighting Inspection Report</title>

<style>
:root{
  --brand-blue:#0060B0;
  --brand-orange:#F06000;
  --text:#1a1a1a;
  --muted:#666;
  --line:#e9e9e9;
  --soft:#fafafa;
}

@page { size: Letter; margin: 0.5in; }

body{
  font-family:"Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size:12px;
  color:var(--text);
  margin:0;
}

/* HEADER */
.report-header{
  display:grid;
  grid-template-columns:180px 1fr 240px;
  align-items:start;
  column-gap:16px;
}

.logo{
  max-height:80px;
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
  line-height:1.35;
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

/* SECTION + CARD */
.section{ margin-bottom:18px; }

.card{
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  overflow:hidden;
  page-break-inside:avoid;
  break-inside:avoid;
}

.section-bar{
  background:var(--brand-blue);
  color:#fff;
  padding:10px 14px;
  font-weight:800;
  letter-spacing:.2px;
}

.card-body{ padding:14px; }

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

/* TABLE */
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
  background:#fff;
}

td{
  padding:8px 6px;
  border-bottom:1px solid var(--line);
  font-size:11px;
  vertical-align:top;
}

tr{
  page-break-inside:avoid;
  break-inside:avoid;
}

/* STATUS BADGES */
.status-badge{
  display:inline-block;
  padding:4px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:.3px;
  border:1px solid transparent;
}

.badge-pass{
  background:#e9f7ef;
  color:#1b5e20;
  border-color:#c8e6c9;
}

.badge-fail{
  background:#fdecea;
  color:#b71c1c;
  border-color:#f5c6cb;
}

.badge-service{
  background:#fff4e5;
  color:#e65100;
  border-color:#ffd8a8;
}

.badge-na{
  background:#f4f4f4;
  color:#555;
  border-color:#ddd;
}

/* SUMMARY */
.summary-grid{
  display:grid;
  grid-template-columns:repeat(4, 1fr);
  gap:10px;
  margin-top:10px;
}

.summary-box{
  border:1px solid var(--line);
  border-radius:10px;
  padding:10px;
  background:#fff;
  text-align:center;
}

.summary-number{
  font-size:18px;
  font-weight:900;
  color:var(--brand-blue);
}

.summary-label{
  font-size:10px;
  color:var(--muted);
  margin-top:2px;
  text-transform:uppercase;
  letter-spacing:.6px;
}

/* SIGNATURE */
.signature-row{
  display:flex;
  justify-content:space-between;
  gap:18px;
  margin-top:6px;
}

.signature-block{ width:48%; }

.signature-line{
  border-bottom:1px solid #000;
  height:40px;
  margin-bottom:6px;
}

/* FOOTER */
.footer{
  margin-top:28px;
  font-size:10px;
  text-align:center;
  color:#888;
}
</style>
</head>

<body>

<!-- HEADER -->
<div class="report-header">
  <div>
    <img class="logo" src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png" alt="NW Fire & Safety Logo">
  </div>

  <div>
    <div class="report-title">Emergency Lighting Inspection Report</div>
    <div class="company-subtitle">
      580-540-3119 | 2517 N Van Buren, Enid, OK 73703<br>
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

<!-- CLIENT / PROPERTY -->
<div class="section">
  <div class="card">
    <div class="section-bar">Client & Property</div>
    <div class="card-body">
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
          <span>${inspection.inspection_type || 'N/A'}</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- EMERGENCY LIGHT INVENTORY -->
<div class="section">
  <div class="card">
    <div class="section-bar">Emergency Light Inventory</div>
    <div class="card-body">
      <table>
        <thead>
          <tr>
            <th style="width:6%;">#</th>
            <th style="width:34%;">Location</th>
            <th style="width:18%;">Type</th>
            <th style="width:18%;">Test Result</th>
            <th style="width:24%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${lightsRows}
        </tbody>
      </table>

      <!-- SUMMARY -->
      <div class="summary-grid">
        <div class="summary-box">
          <div class="summary-number">${totalUnits}</div>
          <div class="summary-label">Total Units</div>
        </div>
        <div class="summary-box">
          <div class="summary-number">${passCount}</div>
          <div class="summary-label">Passed</div>
        </div>
        <div class="summary-box">
          <div class="summary-number">${failCount}</div>
          <div class="summary-label">Failed</div>
        </div>
        <div class="summary-box">
          <div class="summary-number">${naCount}</div>
          <div class="summary-label">N/A</div>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- NFPA NOTE -->
<div class="section">
  <div class="card">
    <div class="section-bar">Code / Compliance Note</div>
    <div class="card-body" style="font-size:11px; line-height:1.45; color:#333;">
      Emergency lighting inspection and functional testing performed in accordance with applicable
      manufacturer requirements and relevant life safety guidance (including NFPA 101 where applicable).
      Any deficiencies noted should be corrected promptly to maintain safe egress illumination.
    </div>
  </div>
</div>

<!-- SIGNATURES -->
<div class="section">
  <div class="card">
    <div class="section-bar">Signatures</div>
    <div class="card-body">
      <div class="signature-row">
        <div class="signature-block">
          <div class="signature-line"></div>
          Technician Signature<br>
          Date: ____________________
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          Customer Signature<br>
          Printed Name: ____________________<br>
          Date: ____________________
        </div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  Generated by NW FIRE Mobile | Emergency Lighting Inspection Report
</div>

</body>
</html>
        `;

        return Response.json({ html });

    } catch (error) {
        console.error('Error generating emergency light report:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});