import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import PDFAnnotator from '@/components/inspections/PDFAnnotator';
import { Upload, FileText, CheckCircle, Loader2 } from 'lucide-react';

export default function PDFSigningFlow({ inspection, onComplete }) {
    const [step, setStep] = useState('upload'); // upload | sign | success
    const [pdfUrl, setPdfUrl] = useState(inspection?.pdf_to_sign || '');
    const [signerName, setSignerName] = useState('');
    const [signatureData, setSignatureData] = useState({ file: null, metadata: null });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.includes('pdf')) {
            setError('Please upload a PDF file');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const uploadResponse = await base44.integrations.Core.UploadFile({
                file: file
            });
            setPdfUrl(uploadResponse.file_url);
            setUploadedFile(file.name);
            setIsLoading(false);
        } catch (err) {
            setError('Failed to upload PDF: ' + err.message);
            setIsLoading(false);
        }
    };

    const handleStartSigning = () => {
        if (!pdfUrl) {
            setError('Please select a PDF first');
            return;
        }
        setStep('sign');
    };

    const handleSignatureSave = (file, metadata) => {
        setSignatureData({ file, metadata });
    };

    const handleSubmitSignature = () => {
        if (!signerName.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!signatureData.file) {
            setError('Please provide a signature');
            return;
        }
        setShowConfirm(true);
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleConfirmSign = async () => {
        setShowConfirm(false);
        setIsLoading(true);
        setError('');

        try {
            // Upload the signature image first
            const uploadSignatureResponse = await base44.integrations.Core.UploadFile({
                file: signatureData.file
            });

            if (!uploadSignatureResponse.file_url) {
                throw new Error("Failed to upload signature image.");
            }

            // Convert signature blob to base64 for PDF-Lib embedding
            const signatureBase64 = await blobToBase64(signatureData.file);

            const response = await base44.functions.invoke('signPDF', {
                inspection_id: inspection.id,
                pdf_file_url: pdfUrl,
                signer_name: signerName,
                signature_png_base64: signatureBase64,
                signed_at: new Date().toISOString(),
                signature_metadata: signatureData.metadata,
                signature_image_url: uploadSignatureResponse.file_url
            });

            if (response.data.success) {
                setStep('success');
                setIsLoading(false);
                setTimeout(() => {
                    if (onComplete) {
                        onComplete(response.data);
                    }
                }, 2000);
            }
        } catch (err) {
            setError('Failed to sign PDF: ' + err.message);
            setIsLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6 flex flex-col items-center gap-4">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                    <div className="text-center">
                        <p className="font-semibold text-green-900">PDF Signed Successfully!</p>
                        <p className="text-sm text-green-800">Signed by {signerName}</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (step === 'sign') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sign Document</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="signer-name">Your Full Name</Label>
                        <Input
                            id="signer-name"
                            placeholder="e.g., John Smith"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Your Signature</Label>
                        <PDFAnnotator
                            pdfUrl={pdfUrl}
                            onSave={handleSignatureSave}
                            initialSignatureImage={inspection?.signature_image}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStep('upload');
                                setSignatureData({ file: null, metadata: null });
                                setSignerName('');
                            }}
                            disabled={isLoading}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleSubmitSignature}
                            disabled={isLoading || !signatureData.file || !signerName.trim()}
                            className="flex-1"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Signing...
                                </>
                            ) : (
                                'Sign & Upload'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Sign PDF Document</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {!pdfUrl ? (
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
                                <label className="cursor-pointer flex flex-col items-center gap-3">
                                    <Upload className="h-8 w-8 text-slate-400" />
                                    <span className="text-sm font-medium text-slate-700">
                                        {isLoading ? 'Uploading...' : 'Click to upload PDF'}
                                    </span>
                                    <span className="text-xs text-slate-500">or drag and drop</span>
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        onChange={handleFileUpload}
                                        disabled={isLoading}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                                <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-blue-900 truncate">
                                        {uploadedFile || 'PDF Ready to Sign'}
                                    </p>
                                    <p className="text-xs text-blue-700">Ready for signature</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setPdfUrl('');
                                        setUploadedFile(null);
                                    }}
                                    disabled={isLoading}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                >
                                    Change
                                </Button>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleStartSigning}
                        disabled={!pdfUrl || isLoading}
                        className="w-full"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            'Continue to Sign'
                        )}
                    </Button>
                </CardContent>
            </Card>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Signature</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are signing as <strong>{signerName}</strong>. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSign}>
                            Confirm & Sign
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}