import React, { useRef, useEffect, useState } from "react";
import { Loader2, Download, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

// Use built-in worker from pdfjs-dist package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export default function PDFViewer({ pdfUrl }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const handleDownload = async () => {
        try {
            const response = await fetch(pdfUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'signed-document.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    useEffect(() => {
        const renderPdf = async () => {
            if (!pdfUrl || !canvasRef.current) {
                setLoading(false);
                return;
            }

            let cleanUrl = '';
            try {
                setLoading(true);
                setError(false);

                cleanUrl = pdfUrl.trim().replace(/[)\]}>.,;]+$/, '');
                if (cleanUrl.includes('supabase.co') && cleanUrl.startsWith('http:')) {
                    cleanUrl = cleanUrl.replace('http:', 'https:');
                }

                const response = await fetch(cleanUrl, { credentials: 'include' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;

                let totalHeight = 0;
                let maxWidth = 0;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    totalHeight += viewport.height;
                    maxWidth = Math.max(maxWidth, viewport.width);
                }

                const canvas = canvasRef.current;
                canvas.width = maxWidth;
                canvas.height = totalHeight;

                const context = canvas.getContext("2d");
                context.clearRect(0, 0, maxWidth, totalHeight);

                let currentY = 0;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });

                    context.save();
                    context.translate(0, currentY);
                    await page.render({ canvasContext: context, viewport }).promise;
                    context.restore();

                    currentY += viewport.height;
                }
            } catch (err) {
                console.error("PDF render error:", err);
                console.error("PDF URL:", cleanUrl);
                console.error("Error details:", err.message, err.stack);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        renderPdf();
    }, [pdfUrl]);

    return (
        <div className="space-y-3">
            <div className={`flex gap-2 ${isFullScreen ? 'fixed top-0 left-0 right-0 z-[60] bg-slate-100 p-3' : ''}`}>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="text-xs"
                >
                    {isFullScreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
                    {isFullScreen ? 'Exit' : 'Full Screen'}
                </Button>
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs gap-2"
                    onClick={handleDownload}
                >
                    <Download className="h-4 w-4" />
                    Download
                </Button>
            </div>

            <div
                ref={containerRef}
                className={`relative bg-white border border-slate-300 rounded-lg overflow-auto ${
                    isFullScreen ? 'fixed inset-0 z-50 rounded-none pt-16' : 'h-[600px]'
                }`}
            >
                {error ? (
                    <iframe 
                        src={pdfUrl} 
                        className="w-full h-full border-0"
                        title="Signed PDF"
                    />
                ) : (
                    <canvas
                        ref={canvasRef}
                        className="block w-full"
                        style={{ height: 'auto', opacity: loading ? 0 : 1 }}
                    />
                )}

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                )}
            </div>
        </div>
    );
}