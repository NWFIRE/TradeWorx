import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Undo2, Download, Trash2, Maximize2, Minimize2, Pen } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

// Use built-in worker from pdfjs-dist package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export default function PDFAnnotator({ pdfUrl, onSave, initialSignatureImage }) {
    const pdfCanvasRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDrawingModeActive, setIsDrawingModeActive] = useState(false);
    const [context, setContext] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastPoint, setLastPoint] = useState(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [pdfDimensions, setPdfDimensions] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(true);
    const [useFallback, setUseFallback] = useState(false);
    const drawingHistory = useRef([]);
    const pdfPagesData = useRef([]);

    useEffect(() => {
        const loadAndRenderPdf = async () => {
            if (!pdfUrl) {
                setPdfLoading(false);
                return;
            }

            try {
                setPdfLoading(true);
                setUseFallback(false);
                
                let cleanUrl = pdfUrl.trim().replace(/[)\]}>.,;]+$/, '');
                if (cleanUrl.includes('supabase.co') && cleanUrl.startsWith('http:')) {
                    cleanUrl = cleanUrl.replace('http:', 'https:');
                }
                
                console.log("📄 Loading PDF:", cleanUrl);

                // Try multiple fetch strategies
                let arrayBuffer;
                try {
                    // First try with credentials
                    const response = await fetch(cleanUrl, { 
                        mode: 'cors',
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/pdf'
                        }
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    arrayBuffer = await response.arrayBuffer();
                } catch (fetchError) {
                    console.log("First fetch failed, trying no-cors mode...");
                    // Fallback: try without credentials
                    const response = await fetch(cleanUrl, { 
                        mode: 'cors',
                        headers: {
                            'Accept': 'application/pdf'
                        }
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    arrayBuffer = await response.arrayBuffer();
                }
                
                console.log("✓ Fetched PDF, size:", arrayBuffer.byteLength);
                
                const loadingTask = pdfjsLib.getDocument({ 
                    data: arrayBuffer,
                    verbosity: 0
                });
                const pdf = await loadingTask.promise;
                console.log("✓ Loaded PDF with", pdf.numPages, "pages");

                if (!pdfCanvasRef.current) return;

                let totalHeight = 0;
                let maxWidth = 0;
                const pageHeights = [];
                const pagesInfo = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    totalHeight += viewport.height;
                    maxWidth = Math.max(maxWidth, viewport.width);
                    pageHeights.push(viewport.height);
                    
                    // Store page info for coordinate conversion
                    pagesInfo.push({
                        pageIndex: i - 1,
                        viewport,
                        canvasYStart: totalHeight - viewport.height,
                        canvasYEnd: totalHeight
                    });
                }
                
                pdfPagesData.current = pagesInfo;

                const pdfCanvas = pdfCanvasRef.current;
                pdfCanvas.width = maxWidth;
                pdfCanvas.height = totalHeight;

                const pdfContext = pdfCanvas.getContext("2d");
                pdfContext.clearRect(0, 0, maxWidth, totalHeight);

                let currentY = 0;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });

                    pdfContext.save();
                    pdfContext.translate(0, currentY);
                    await page.render({ canvasContext: pdfContext, viewport }).promise;
                    pdfContext.restore();
                    
                    currentY += viewport.height;
                }

                setPdfDimensions({ width: maxWidth, height: totalHeight, pageHeights, numPages: pdf.numPages });
                console.log("✓ Rendered all pages");
            } catch (error) {
                console.error("❌ PDF load error:", error);
                console.error("Error details:", error.message, error.stack);
                setUseFallback(true);
            } finally {
                setPdfLoading(false);
            }
        };

        loadAndRenderPdf();
    }, [pdfUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && pdfDimensions) {
            const ctx = canvas.getContext("2d");
            setContext(ctx);
            
            // Set canvas to match PDF dimensions exactly
            canvas.width = pdfDimensions.width;
            canvas.height = pdfDimensions.height;

            // Load initial signature image if provided
            if (initialSignatureImage) {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = initialSignatureImage;
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    drawingHistory.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                };
                img.onerror = (err) => {
                    console.error("Failed to load initial signature image:", err);
                    toast.error("Failed to load previous signature.");
                };
            }
        }
    }, [initialSignatureImage, pdfDimensions]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Convert screen coordinates to canvas internal coordinates
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        return { x, y };
    };

    const startDrawing = (e) => {
        if (!context || !isDrawingModeActive) return;
        const canvas = canvasRef.current;
        drawingHistory.current.push(
            context.getImageData(0, 0, canvas.width, canvas.height)
        );
        
        const { x, y } = getCoordinates(e);
        setLastPoint({ x, y });
        setIsDrawing(true);
        
        context.beginPath();
        context.moveTo(x, y);
        e.preventDefault();
    };

    const draw = (e) => {
        if (!isDrawing || !context || !lastPoint) return;

        const { x, y } = getCoordinates(e);

        context.strokeStyle = "#FF0000";
        context.lineWidth = 3;
        context.lineCap = "round";
        context.lineJoin = "round";

        context.lineTo(x, y);
        context.stroke();
        
        setLastPoint({ x, y });
        e.preventDefault();
    };

    const stopDrawing = () => {
        if (context) {
            context.closePath();
        }
        setIsDrawing(false);
        setLastPoint(null);
    };

    const undo = () => {
        if (drawingHistory.current.length > 0 && context) {
            const imageData = drawingHistory.current.pop();
            context.putImageData(imageData, 0, 0);
        }
    };

    const clearAll = () => {
        if (context && canvasRef.current) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            // Force canvas to reset its internal state to ensure it's truly blank
            canvasRef.current.width = canvasRef.current.width;
            drawingHistory.current = [];
        }
    };

    const downloadAnnotated = async () => {
        try {
            setIsSaving(true);
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // Get all pixels to find the bounding box of the signature
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            
            let minX = canvas.width;
            let minY = canvas.height;
            let maxX = 0;
            let maxY = 0;
            let hasDrawing = false;
            
            // Find the bounding box of non-transparent pixels
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const index = (y * canvas.width + x) * 4;
                    const alpha = pixels[index + 3];
                    
                    if (alpha > 0) {
                        hasDrawing = true;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }
            
            if (!hasDrawing) {
                toast.error("Please draw a signature first");
                setIsSaving(false);
                return;
            }
            
            // Add padding around the signature
            const padding = 10;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(canvas.width, maxX + padding);
            maxY = Math.min(canvas.height, maxY + padding);
            
            const signatureWidth = maxX - minX;
            const signatureHeight = maxY - minY;
            
            // Determine which page the signature belongs to
            const signatureCenterY = minY + signatureHeight / 2;
            let targetPageInfo = pdfPagesData.current[0];
            
            for (const pageInfo of pdfPagesData.current) {
                if (signatureCenterY >= pageInfo.canvasYStart && signatureCenterY < pageInfo.canvasYEnd) {
                    targetPageInfo = pageInfo;
                    break;
                }
            }
            
            // Convert canvas coordinates to PDF points using the viewport
            const viewport = targetPageInfo.viewport;
            const yRelativeToPage = minY - targetPageInfo.canvasYStart;
            
            // Viewport is scaled at 1.5x, so we need to scale back to unscaled viewport coordinates first
            const unscaledX = minX / 1.5;
            const unscaledY = yRelativeToPage / 1.5;
            const unscaledWidth = signatureWidth / 1.5;
            const unscaledHeight = signatureHeight / 1.5;
            
            // Convert top-left and bottom-right corners to PDF points
            const [pdfX1, pdfY1] = viewport.convertToPdfPoint(unscaledX, unscaledY);
            const [pdfX2, pdfY2] = viewport.convertToPdfPoint(unscaledX + unscaledWidth, unscaledY + unscaledHeight);
            
            const rectInPdfPoints = {
                x: Math.min(pdfX1, pdfX2),
                y: Math.min(pdfY1, pdfY2), // PDF Y is bottom-up, min is lower on page
                width: Math.abs(pdfX2 - pdfX1),
                height: Math.abs(pdfY2 - pdfY1)
            };
            
            // Create a new canvas with just the signature
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = signatureWidth;
            croppedCanvas.height = signatureHeight;
            const croppedCtx = croppedCanvas.getContext('2d');
            
            // Copy the signature portion to the new canvas
            croppedCtx.drawImage(
                canvas,
                minX, minY, signatureWidth, signatureHeight,
                0, 0, signatureWidth, signatureHeight
            );
            
            // Convert to blob
            const imageDataUrl = croppedCanvas.toDataURL("image/png");
            const blob = await (await fetch(imageDataUrl)).blob();
            const file = new File([blob], `signature_${Date.now()}.png`, { type: 'image/png' });
            
            // Upload to server with PDF-accurate position metadata
            const uploadResult = await onSave?.(file, {
                pageIndex: targetPageInfo.pageIndex,
                rectInPdfPoints: rectInPdfPoints
            });
            
            toast.success("Signature saved successfully");
            return uploadResult;
        } catch (error) {
            toast.error("Failed to save signature");
            console.error("Save error:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className={`flex flex-col bg-slate-100 p-3 rounded-lg gap-3 ${isFullScreen ? 'fixed top-0 left-0 right-0 z-[60] m-0 rounded-none' : ''}`}>
                <p className="text-sm font-medium text-slate-700">Draw on PDF to add signature</p>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:flex-wrap">
                    <Button
                        size="sm"
                        variant={isDrawingModeActive ? "default" : "outline"}
                        onClick={() => setIsDrawingModeActive(!isDrawingModeActive)}
                        className={`w-full sm:w-auto text-xs ${isDrawingModeActive ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                    >
                        <Pen className="h-4 w-4 mr-1" />
                        {isDrawingModeActive ? 'Drawing' : 'Draw'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={undo}
                        disabled={drawingHistory.current.length === 0}
                        className="w-full sm:w-auto text-xs"
                    >
                        <Undo2 className="h-4 w-4 mr-1" />
                        Undo
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearAll}
                        className="text-red-600 hover:bg-red-50 w-full sm:w-auto text-xs"
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="w-full sm:w-auto text-xs"
                    >
                        {isFullScreen ? (
                            <>
                                <Minimize2 className="h-4 w-4 mr-1" />
                                Exit
                            </>
                        ) : (
                            <>
                                <Maximize2 className="h-4 w-4 mr-1" />
                                Full
                            </>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        onClick={downloadAnnotated}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-xs"
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <Download className="h-4 w-4 mr-1" />
                        )}
                        Save
                    </Button>
                </div>
            </div>

            <div 
                ref={containerRef}
                className={`relative bg-white border border-slate-300 rounded-lg overflow-auto ${
                    isFullScreen 
                        ? 'fixed inset-0 z-50 rounded-none h-screen pt-16' 
                        : 'h-[400px] sm:h-[600px]'
                }`}
            >
                {useFallback ? (
                    <div className="p-8 text-center">
                        <p className="text-slate-600 mb-4">Unable to render PDF for annotation</p>
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            Open PDF in new tab
                        </a>
                    </div>
                ) : (
                    <>
                        {/* PDF rendered canvas */}
                        <canvas
                            ref={pdfCanvasRef}
                            className="pointer-events-none block w-full"
                            style={{ height: 'auto', opacity: pdfLoading ? 0 : 1 }}
                        />

                        {/* Drawing canvas overlay */}
                        <canvas
                            ref={canvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className={`absolute top-0 left-0 touch-none ${
                                isDrawingModeActive ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
                            }`}
                            style={{ opacity: pdfLoading ? 0 : 1 }}
                        />
                    </>
                )}

                {/* Loading overlay */}
                {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                )}
            </div>

            <div className="text-xs text-slate-500">
                💡 Click the "Draw" button to enable drawing mode, then scroll through the PDF and draw with your mouse or finger to add signatures or annotations.
            </div>
        </div>
    );
}