import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function SignaturePad({ label, value, onChange }) {
    const canvasRef = useRef(null);
    const [drawing, setDrawing] = useState(false);
    const [status, setStatus] = useState('');
    const lastPoint = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111';

        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width * dpr));
            const height = Math.max(1, Math.floor(rect.height * dpr));

            const prev = document.createElement('canvas');
            prev.width = canvas.width;
            prev.height = canvas.height;
            const prevCtx = prev.getContext('2d');
            prevCtx.drawImage(canvas, 0, 0);

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                
                // Scale to fit properly
                const scaleX = rect.width / (prev.width / dpr);
                const scaleY = rect.height / (prev.height / dpr);
                const scale = Math.min(scaleX, scaleY);
                const x = (rect.width - (prev.width / dpr) * scale) / 2;
                const y = (rect.height - (prev.height / dpr) * scale) / 2;
                
                ctx.drawImage(prev, 0, 0, prev.width / dpr, prev.height / dpr, 
                              x, y, (prev.width / dpr) * scale, (prev.height / dpr) * scale);
                
                // Reset line styles after resize
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#111';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(resizeCanvas, 100);
        });

        // Load existing signature
        if (value) {
            const img = new Image();
            img.onload = () => {
                resizeCanvas();
                const rect = canvas.getBoundingClientRect();
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
            };
            img.src = value;
        }

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('orientationchange', resizeCanvas);
        };
    }, [value]);

    const getPoint = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches && e.touches[0];
        const clientX = touch ? touch.clientX : e.clientX;
        const clientY = touch ? touch.clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handleStart = (e) => {
        e.preventDefault();
        setDrawing(true);
        lastPoint.current = getPoint(e);
    };

    const handleMove = (e) => {
        if (!drawing) return;
        e.preventDefault();
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const p = getPoint(e);
        
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        lastPoint.current = p;
        setStatus('Unsaved signature');
    };

    const handleEnd = (e) => {
        if (!drawing) return;
        e.preventDefault();
        setDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const dpr = window.devicePixelRatio || 1;
        ctx.scale(dpr, dpr);
        
        onChange('');
        setStatus('Cleared');
    };

    const isBlank = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < img.length; i += 4) {
            if (img[i] !== 0) return false;
        }
        return true;
    };

    const handleSave = () => {
        if (isBlank()) {
            setStatus('Please sign before saving');
            return;
        }
        
        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');
        onChange(dataUrl);
        setStatus('Saved');
    };

    return (
        <div className="space-y-2">
            <Label>{label || 'Signature'}</Label>
            <div className="border rounded-lg overflow-hidden bg-white">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[220px] touch-none block bg-white"
                    onPointerDown={handleStart}
                    onPointerMove={handleMove}
                    onPointerUp={handleEnd}
                    onPointerCancel={handleEnd}
                    onPointerLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                    onTouchCancel={handleEnd}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
                <Button type="button" variant="outline" onClick={handleClear}>
                    Clear
                </Button>
                <Button type="button" onClick={handleSave}>
                    Save Signature
                </Button>
                {status && <span className="text-sm text-slate-600">{status}</span>}
            </div>
        </div>
    );
}