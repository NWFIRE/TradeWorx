import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EmailPreview() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link to={createPageUrl("Dashboard")}>
                        <Button variant="ghost" className="text-white">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                <Card className="card-dark">
                    <CardHeader>
                        <CardTitle className="text-gradient">Monthly Inspection Reminder Email Preview</CardTitle>
                        <p className="text-slate-400 text-sm mt-2">This is how the email will appear to your clients</p>
                    </CardHeader>
                    <CardContent>
                        {/* Email Container */}
                        <div className="bg-white rounded-lg p-8 max-w-2xl mx-auto">
                            {/* Logo */}
                            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <img 
                                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696ea7ea2af617913d24cec9/2014ca4e0_IMG_5002.png" 
                                    alt="NW FIRE & SAFETY" 
                                    style={{ maxWidth: '300px', height: 'auto', margin: '0 auto' }} 
                                />
                            </div>

                            {/* Email Body */}
                            <p style={{ color: '#333', marginBottom: '15px' }}>Dear ABC Corporation,</p>

                            <p style={{ color: '#333', marginBottom: '15px' }}>
                                This is a friendly reminder of your upcoming fire and life safety services scheduled for next month.
                            </p>

                            <p style={{ color: '#333', marginBottom: '10px', fontWeight: 'bold' }}>
                                Here are the details for your upcoming inspections:
                            </p>

                            <ul style={{ color: '#333', marginBottom: '20px', paddingLeft: '20px' }}>
                                <li style={{ marginBottom: '15px' }}>
                                    <strong>Scheduled For:</strong> March 2026<br />
                                    <strong>Services:</strong> Fire Extinguisher, Fire Alarm
                                </li>
                                <li style={{ marginBottom: '15px' }}>
                                    <strong>Scheduled For:</strong> March 15, 2026<br />
                                    <strong>Services:</strong> Kitchen Suppression
                                </li>
                            </ul>

                            <p style={{ color: '#333', marginBottom: '30px' }}>
                                We will be in touch shortly to confirm the exact date and time. Please feel free to reach out if you have any questions.
                            </p>

                            {/* Divider */}
                            <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ccc' }} />

                            {/* Footer */}
                            <div style={{ textAlign: 'center', color: '#666' }}>
                                <p style={{ margin: '5px 0' }}>580-540-3119 | 2517 N Van Buren, Enid, OK 73703</p>
                                <p style={{ margin: '5px 0' }}>OK #AC441117, #466</p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-800">
                            <p className="text-sm text-blue-200">
                                <strong>Note:</strong> The actual email will include the client's company name, their specific inspection dates, and services based on the scheduled inspections for next month.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}