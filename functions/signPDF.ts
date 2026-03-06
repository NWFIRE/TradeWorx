import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const {
            inspection_id,
            pdf_file_url,
            signer_name,
            signature_png_base64,
            signed_at,
            signature_metadata,
            signature_image_url
        } = await req.json();

        // Authorization: verify user can sign this inspection
        const inspection = await base44.entities.Inspection.get(inspection_id);
        if (!inspection) {
            return Response.json({ error: 'Inspection not found' }, { status: 404 });
        }
        
        // Allow if user is the assigned inspector or admin
        const userProfile = (await base44.entities.UserProfile.filter({ user_id: user.id }))[0];
        const isAdmin = userProfile?.role === 'admin';
        const isAssignedInspector = inspection.inspector_id === user.id;
        
        if (!isAdmin && !isAssignedInspector) {
            return Response.json({ error: 'Forbidden: cannot sign this inspection' }, { status: 403 });
        }

        // SSRF protection: allowlist storage domains
        const allowedDomains = ['supabase.co', 'googleapis.com', 'cloudfront.net', 'base44.app'];
        const pdfUrl = new URL(pdf_file_url);
        const isDomainAllowed = allowedDomains.some(domain => pdfUrl.hostname.includes(domain));
        
        if (!isDomainAllowed) {
            console.error('PDF domain not allowed:', pdfUrl.hostname);
            return Response.json({ error: 'Invalid PDF URL domain' }, { status: 400 });
        }

        // Fetch the original PDF
        let pdfBytes;
        try {
            const pdfResponse = await fetch(pdf_file_url, {
                mode: 'cors',
                credentials: 'include'
            });
            if (!pdfResponse.ok) {
                console.error('PDF fetch failed with status:', pdfResponse.status);
                return Response.json({ error: `Failed to fetch PDF: ${pdfResponse.status}` }, { status: 502 });
            }
            pdfBytes = await pdfResponse.arrayBuffer();
        } catch (fetchError) {
            console.error('PDF fetch error:', fetchError.message);
            return Response.json({ error: `Failed to fetch PDF: ${fetchError.message}` }, { status: 502 });
        }

        // Load the PDF document
        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfBytes);
        } catch (loadError) {
            console.error('PDF load error:', loadError.message);
            return Response.json({ error: `Failed to load PDF: ${loadError.message}` }, { status: 400 });
        }
        const pages = pdfDoc.getPages();

        // Embed signature image
        let signatureImage = null;
        if (signature_png_base64) {
            // Handle both data URL and raw base64
            const base64Data = signature_png_base64.includes(',') 
                ? signature_png_base64.split(',')[1] 
                : signature_png_base64;
            const imageBytes = Uint8Array.from(
                atob(base64Data),
                c => c.charCodeAt(0)
            );
            signatureImage = await pdfDoc.embedPng(imageBytes);
        }

        // Use new metadata format (pageIndex + rectInPdfPoints)
        if (signatureImage && signature_metadata?.pageIndex !== undefined && signature_metadata?.rectInPdfPoints) {
            const { pageIndex, rectInPdfPoints } = signature_metadata;
            const targetPage = pages[pageIndex];
            
            if (!targetPage) {
                return Response.json({ error: `Invalid page index: ${pageIndex}` }, { status: 400 });
            }

            // Draw signature directly using PDF points from frontend
            targetPage.drawImage(signatureImage, {
                x: rectInPdfPoints.x,
                y: rectInPdfPoints.y,
                width: rectInPdfPoints.width,
                height: rectInPdfPoints.height
            });

            // Draw signer name and date just below the signature
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontSize = 10;
            const textX = rectInPdfPoints.x;
            const textY = rectInPdfPoints.y - (fontSize * 1.5);

            targetPage.drawText(`Signed by: ${signer_name}`, {
                x: textX,
                y: textY,
                size: fontSize,
                font,
                color: rgb(0, 0, 0)
            });

            targetPage.drawText(`Date: ${new Date(signed_at).toLocaleDateString()}`, {
                x: textX,
                y: textY - (fontSize * 1.2),
                size: fontSize,
                font,
                color: rgb(0, 0, 0)
            });

        } else if (signatureImage) {
            // Fallback for legacy format or missing metadata
            const lastPage = pages[pages.length - 1];
            const { height: pdfHeight } = lastPage.getSize();
            
            lastPage.drawImage(signatureImage, {
                x: 50,
                y: pdfHeight - 150,
                width: 150,
                height: 80
            });
            
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            lastPage.drawText(`Signed by: ${signer_name}`, {
                x: 50,
                y: pdfHeight - 155,
                size: 10,
                font,
                color: rgb(0, 0, 0)
            });
            lastPage.drawText(`Date: ${new Date(signed_at).toLocaleDateString()}`, {
                x: 50,
                y: pdfHeight - 170,
                size: 10,
                font,
                color: rgb(0, 0, 0)
            });
        }

        // Save the signed PDF
        const signedPdfBytes = await pdfDoc.save();
        const blob = new Blob([signedPdfBytes], { type: 'application/pdf' });

        // Upload signed PDF
        const uploadResponse = await base44.integrations.Core.UploadFile({
            file: blob
        });

        // Update the inspection
        await base44.entities.Inspection.update(inspection_id, {
            signed_pdf: uploadResponse.file_url,
            signed_by_name: signer_name,
            signed_at: signed_at,
            signature_status: 'Signed',
            signature_image: signature_image_url
        });

        return Response.json({
            success: true,
            signed_pdf_url: uploadResponse.file_url
        });
    } catch (error) {
        console.error("Error in signPDF function:", error);
        console.error("Error stack:", error.stack);
        return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
    }
});