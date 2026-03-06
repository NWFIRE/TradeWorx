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
      return Response.json({ 
        success: false, 
        error: 'inspection_id is required' 
      }, { status: 400 });
    }

    // Fetch inspection
    const inspections = await base44.entities.Inspection.filter({ id: inspection_id });
    const inspection = inspections[0];

    if (!inspection) {
      return Response.json({
        success: false,
        html_content: `<html><body style="font-family:Arial">Inspection not found: ${escapeHtml(String(inspection_id))}</body></html>`,
        inspection_id,
      });
    }

    // Fetch related data
    const properties = await base44.entities.Property.list();
    const clients = await base44.entities.Client.list();
    
    const property = properties.find(p => p.id === inspection.property_id);
    const client = clients.find(c => c.id === inspection.client_id);

    // Parse work order data from inspection notes
    let workOrderData = {};
    try {
      if (inspection.notes) {
        workOrderData = JSON.parse(inspection.notes);
      }
    } catch (e) {
      console.log("No work order data in notes");
    }

    // Map data for template
    const data = {
      reportTitle: "WORK ORDER REPORT",
      companyLine: "Northwest Fire & Safety, LLC",
      date: formatDate(workOrderData.job_date || inspection.scheduled_date || inspection.updated_date),
      tech: workOrderData.technician_name || inspection.inspector_name || "N/A",
      reportNo: inspection_id.slice(0, 8).toUpperCase(),
      customer: workOrderData.customer_name || client?.company_name || "—",
      location: property?.name || property?.address || "N/A",
      hours: toStr(workOrderData.jobsite_hours || "—"),
      followUp: toYesNo(workOrderData.follow_up_required || false),
      servicePerformed: toStr(workOrderData.service_performed || "—"),
      jobNotes: toStr(workOrderData.job_notes || ""),
      customerName: workOrderData.customer_print_name || workOrderData.customer_name || "—",
      customerSignatureImage: normalizeDataImage(workOrderData.customer_signature || ""),
      signedDate: formatDate(workOrderData.job_date || inspection.scheduled_date),
    };

    const html = renderWorkOrderPremiumHTML(data);

    return Response.json({
      success: true,
      html_content: html,
      inspection_id,
    });

  } catch (error) {
    console.error('Error generating work order report:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

function renderWorkOrderPremiumHTML(d) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(d.reportTitle)}</title>
  <style>
    :root{
      --brand-blue:#0060B0;
      --brand-orange:#F06000;
      --text:#0b1220;
      --muted:#556070;
      --border:#e6ebf2;
      --card:#ffffff;
      --bg:#f6f8fb;
    }

    @page { margin: 14mm; }
    *{ box-sizing:border-box; }
    body{
      margin:0;
      font-family: Arial, Helvetica, sans-serif;
      color:var(--text);
      background: var(--bg);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page{ max-width: 900px; margin: 0 auto; padding: 16px 16px 22px; }

    /* Header */
    .header{
      background: var(--card);
      border:1px solid var(--border);
      border-radius: 14px;
      padding: 14px 14px 10px;
      page-break-inside: avoid;
    }
    .header-top{
      display:grid;
      grid-template-columns: 1fr 2fr 1fr;
      gap:12px;
      align-items: start;
    }
    .logo{ height: 44px; width:auto; object-fit: contain; }
    .title-wrap{ text-align:center; padding-top: 2px; }
    .title{ font-size: 20px; font-weight: 800; letter-spacing: 0.5px; margin:0; }
    .company-line{ margin:4px 0 0; font-size:12px; color:var(--muted); font-weight: 700; }
    .meta{
      border:1px solid var(--border);
      border-radius: 12px;
      padding:10px 10px;
      font-size:12px;
      background:#fff;
    }
    .meta-row{ display:flex; justify-content: space-between; gap:10px; padding:2px 0; }
    .meta-label{ color:var(--muted); font-weight:800; }
    .meta-value{ font-weight:800; }

    .divider{ height: 10px; background: var(--brand-orange); border-radius: 10px; margin-top: 10px; }

    /* Cards / Sections */
    .top-grids{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:12px;
      margin-top: 12px;
    }
    .mini-card{
      background: var(--card);
      border:1px solid var(--border);
      border-radius: 14px;
      padding: 12px 12px;
      page-break-inside: avoid;
    }
    .mini-title{
      font-size: 12px;
      font-weight: 900;
      color: var(--brand-blue);
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    .kv{
      display:flex;
      gap:10px;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px dashed #edf1f7;
    }
    .kv:last-child{ border-bottom:none; }
    .k{ color:var(--muted); font-weight:800; font-size:12px; }
    .v{ font-weight:800; font-size:12px; text-align:right; max-width: 60%; }

    .section{
      margin-top: 12px;
      border:1px solid var(--border);
      border-radius: 14px;
      overflow:hidden;
      background: var(--card);
      page-break-inside: avoid;
    }
    .section-h{
      background: var(--brand-blue);
      color:#fff;
      font-weight: 900;
      padding: 10px 12px;
      font-size: 13px;
      letter-spacing: .3px;
      text-transform: uppercase;
    }
    .section-b{ padding: 12px 12px 14px; }

    .muted{ color:var(--muted); }

    /* Badges */
    .badge{
      display:inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .3px;
      line-height: 1.5;
      border:1px solid transparent;
      white-space: nowrap;
    }
    .badge-green{ background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.40); color:#0f5132; }
    .badge-gray{ background: rgba(148,163,184,0.18); border-color: rgba(148,163,184,0.45); color:#334155; }

    /* Service text */
    .service{
      border:1px solid var(--border);
      border-radius: 12px;
      padding: 12px 12px;
      background:#fff;
      line-height: 1.55;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }

    /* Signature */
    .sig-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:12px;
      page-break-inside: avoid;
    }
    .sig-box{
      border:1px solid var(--border);
      border-radius: 14px;
      background:#fff;
      padding: 12px 12px;
      min-height: 120px;
      display:flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-img{
      max-height: 70px;
      width: 100%;
      object-fit: contain;
      margin-top: 6px;
    }
    .sig-line{
      height: 1px;
      background: #d9e2ef;
      margin: 10px 0 6px;
    }
    .sig-label{ font-size: 12px; font-weight: 900; color: var(--muted); }
    .sig-value{ font-size: 12px; font-weight: 900; }

    .footer{
      margin-top: 12px;
      text-align:center;
      font-size: 11px;
      color: var(--muted);
      padding: 8px 0 0;
    }

    @media (max-width: 720px){
      .header-top{ grid-template-columns: 1fr; }
      .title-wrap{ text-align:left; }
      .top-grids{ grid-template-columns: 1fr; }
      .sig-grid{ grid-template-columns: 1fr; }
      .v{ text-align:left; max-width: 100%; }
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div>
          <img class="logo" src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/de84799aa_NWFIRE-MobileNoBG.png" alt="NW FIRE" />
        </div>

        <div class="title-wrap">
          <h1 class="title">${escapeHtml(d.reportTitle)}</h1>
          <div class="company-line">${escapeHtml(d.companyLine)}</div>
        </div>

        <div class="meta">
          <div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${escapeHtml(d.date)}</span></div>
          <div class="meta-row"><span class="meta-label">Tech</span><span class="meta-value">${escapeHtml(d.tech)}</span></div>
          <div class="meta-row"><span class="meta-label">Work Order #</span><span class="meta-value">${escapeHtml(String(d.reportNo))}</span></div>
        </div>
      </div>
      <div class="divider"></div>
    </div>

    <div class="top-grids">
      <div class="mini-card">
        <div class="mini-title">Customer</div>
        ${kv("Customer", escapeHtml(d.customer))}
        ${kv("Location", escapeHtml(d.location))}
      </div>

      <div class="mini-card">
        <div class="mini-title">Work Details</div>
        ${kv("Hours", escapeHtml(d.hours))}
        ${kv("Follow-up", badgeYN(d.followUp))}
      </div>
    </div>

    <section class="section">
      <div class="section-h">Service Performed</div>
      <div class="section-b">
        <div class="service">${escapeHtml(d.servicePerformed)}</div>
      </div>
    </section>

    ${d.jobNotes ? `
    <section class="section">
      <div class="section-h">Parts/Equipment Used</div>
      <div class="section-b">
        <div class="service">${escapeHtml(d.jobNotes)}</div>
      </div>
    </section>` : ''}

    <section class="section">
      <div class="section-h">Signatures</div>
      <div class="section-b">
        <div class="sig-grid">
          ${signatureCard("Customer", d.customerName, d.customerSignatureImage)}
          ${signatureCard("Technician", d.tech, "")}
        </div>
        <div class="footer">Signed Date: <b>${escapeHtml(d.signedDate)}</b></div>
      </div>
    </section>

    <div class="footer">
      2517 N Van Buren • Enid, OK 73703 • (580) 540-3119
    </div>
  </div>
</body>
</html>`;
}

function kv(k, vHtml) {
  return `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v">${vHtml}</div></div>`;
}

function badgeYN(v) {
  const yes = String(v).toLowerCase() === "yes";
  return `<span class="badge ${yes ? "badge-green" : "badge-gray"}">${yes ? "YES" : "NO"}</span>`;
}

function signatureCard(label, name, sigImg) {
  const hasImg = sigImg && sigImg.startsWith("data:image/");
  return `
  <div class="sig-box">
    <div>
      <div class="sig-label">${escapeHtml(label)} Name</div>
      <div class="sig-value">${escapeHtml(name || "—")}</div>
      <div class="sig-line"></div>
      <div class="sig-label">Signature</div>
      ${
        hasImg
          ? `<img class="sig-img" src="${sigImg}" alt="${escapeHtml(label)} Signature" />`
          : `<div class="muted" style="font-size:12px;font-weight:700;margin-top:6px;">Signed on file / Not provided</div>`
      }
    </div>
  </div>`;
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const yy = dt.getFullYear();
      return `${mm}/${dd}/${yy}`;
    }
  } catch {}
  return (d ?? "—").toString();
}

function toYesNo(v) {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "true" || s === "yes" || s === "y" || s === "1") return "Yes";
  return "No";
}

function toStr(v) {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function normalizeDataImage(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("data:image/")) return s;
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) return `data:image/png;base64,${s}`;
  return "";
}