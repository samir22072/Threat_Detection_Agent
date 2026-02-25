"use client";

import { ScanReport } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ShieldCheck, Activity, Search, ExternalLink, Mail, Send, Check, Loader2 } from "lucide-react";
import { useState } from "react";

interface IncidentReportProps {
    report: ScanReport;
    sessionId: string;
}

export function IncidentReport({ report, sessionId }: IncidentReportProps) {
    const { summary, incidents, executiveSummary } = report;

    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState(false);

    const handleSendEmail = async () => {
        if (!emailInput.trim()) return;
        setIsSendingEmail(true);
        setEmailSuccess(false);

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const emails = emailInput.split(',').map(e => e.trim()).filter(e => e);

            const resp = await fetch(`${API_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, emails })
            });

            if (!resp.ok) {
                throw new Error("Failed to send email");
            }

            setEmailSuccess(true);
            setTimeout(() => {
                setIsEmailOpen(false);
                setEmailSuccess(false);
                setEmailInput("");
            }, 3000);

        } catch (e) {
            console.error(e);
            alert("Failed to send report via email. Ensure backend is running and configured.");
        } finally {
            setIsSendingEmail(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'critical': return 'text-red-600';
            case 'high': return 'text-orange-500';
            case 'medium': return 'text-[#D2B589]';
            default: return 'text-[#0E6246]';
        }
    };

    const getSeverityBadge = (severity: string) => {
        const s = severity?.toLowerCase();
        if (s === 'critical') return 'bg-red-50 text-red-600 border-red-200';
        if (s === 'high') return 'bg-orange-50 text-orange-600 border-orange-200';
        if (s === 'medium') return 'bg-[#D2B589]/10 text-[#D2B589] border-[#D2B589]/30';
        return 'bg-[#0E6246]/10 text-[#0E6246] border-[#0E6246]/30';
    };

    return (
        <div className="space-y-10 animate-in fade-in zoom-in-95 duration-1000">
            {/* Executive Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Overall Risk", value: executiveSummary.overallRiskLevel, icon: Activity, color: getRiskColor(executiveSummary.overallRiskLevel) },
                    { label: "Total Threats", value: summary.totalIncidents, icon: AlertTriangle, color: "text-[#19314B]" },
                    { label: "Critical", value: summary.criticalCount, icon: ShieldCheck, color: "text-red-600" },
                    { label: "Research Coverage", value: "DEEP", icon: Search, color: "text-[#0E6246]" },
                ].map((item, i) => (
                    <Card key={i} className="bg-white border-gray-200 shadow-sm relative rounded-none">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <item.icon className="w-12 h-12" />
                        </div>
                        <CardContent className="pt-6">
                            <p className="text-[10px] text-gray-500 uppercase font-sans font-bold tracking-widest mb-1">{item.label}</p>
                            <div className={`text-2xl font-black tracking-tighter ${item.color}`}>
                                {item.value}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Executive Summary Details */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-gray-200 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6 bg-[#19314B]" />
                        <h3 className="text-xl font-black tracking-tight text-[#19314B] uppercase">Executive Summary</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEmailOpen ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                                <Input
                                    placeholder="Enter emails (comma separated)"
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    className="h-8 max-w-xs text-xs font-sans rounded-none border-gray-300 focus:border-[#19314B]"
                                    disabled={isSendingEmail || emailSuccess}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSendEmail}
                                    disabled={isSendingEmail || emailSuccess || !emailInput.trim()}
                                    className="h-8 px-4 rounded-none bg-[#19314B] hover:bg-[#19314B]/90 text-white font-bold tracking-widest text-xs uppercase"
                                >
                                    {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                                        emailSuccess ? <Check className="w-3.5 h-3.5 text-green-400" /> :
                                            <Send className="w-3.5 h-3.5" />}
                                </Button>
                                {!isSendingEmail && !emailSuccess && (
                                    <Button variant="ghost" size="sm" onClick={() => setIsEmailOpen(false)} className="h-8 px-2 text-gray-400 hover:text-gray-600 rounded-none">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEmailOpen(true)}
                                className="h-8 border-gray-200 text-[#19314B] hover:bg-gray-50 font-bold tracking-widest uppercase text-xs rounded-none shadow-sm"
                            >
                                <Mail className="w-3.5 h-3.5 mr-2" /> Share via Email
                            </Button>
                        )}
                    </div>
                </div>
                <Card className="bg-white border-gray-200 rounded-none shadow-sm">
                    <CardContent className="pt-6 space-y-6">
                        <p className="text-gray-700 leading-relaxed font-sans">{executiveSummary.businessImpact}</p>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-[#19314B] uppercase tracking-wider">Key Findings</h4>
                            <ul className="space-y-2">
                                {executiveSummary.keyFindings.map((finding, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-none bg-[#D2B589] mt-2 shrink-0" />
                                        <span className="text-gray-600 font-sans">{finding}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="text-sm font-bold text-[#0E6246] uppercase tracking-wider">Immediate Actions Required</h4>
                            <ul className="space-y-2">
                                {executiveSummary.immediateActions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-none bg-[#0E6246] mt-2 shrink-0" />
                                        <span className="text-gray-600 font-sans">{action}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Individual Incidents */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-2">
                    <div className="w-1 h-6 bg-[#19314B]" />
                    <h3 className="text-xl font-black tracking-tight text-[#19314B] uppercase">Impact Analysis Report</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {incidents.map((inc, i) => (
                        <Card key={i} className="bg-white border-gray-200 hover:border-[#19314B]/30 transition-all duration-300 group rounded-none shadow-sm">
                            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="space-y-1.5">
                                    <CardTitle className="text-lg font-bold text-[#19314B] group-hover:text-[#0E6246] transition-colors">
                                        {inc.incident}
                                    </CardTitle>
                                    {inc.incidentDate && (
                                        <p className="text-[10px] font-sans text-gray-500 uppercase font-bold tracking-widest flex items-center gap-1.5">
                                            <Activity className="w-3 h-3 text-[#D2B589]" />
                                            Incident Recorded: {inc.incidentDate}
                                        </p>
                                    )}
                                </div>
                                <Badge className={`${getSeverityBadge(inc.severity)} font-sans font-bold uppercase tracking-widest mt-1 rounded-sm`}>
                                    {inc.severity}
                                </Badge>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Technical Impact</p>
                                            <p className="text-[13px] text-gray-700 leading-relaxed font-sans">
                                                {inc.impactAnalysis}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {inc.cve?.map(c => (
                                                <Badge key={c} variant="secondary" className="bg-gray-100 text-[#19314B] text-[10px] font-sans font-bold border-gray-200 rounded-sm">
                                                    {c}
                                                </Badge>
                                            ))}
                                        </div>
                                        {inc.sourceLinks && inc.sourceLinks.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-[10px] text-[#0E6246] uppercase font-black tracking-widest mb-2 flex items-center gap-1">
                                                    <Search className="w-3 h-3" /> External Intelligence Sources
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {inc.sourceLinks.map((link, idx) => {
                                                        const isUrl = link.startsWith('http://') || link.startsWith('https://');
                                                        const href = isUrl ? link : `https://${link}`;
                                                        const display = link.replace(/^https?:\/\//, '').substring(0, 40) + (link.length > 40 ? '...' : '');
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] text-[#19314B] hover:text-[#0E6246] bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-sm flex items-center gap-1.5 transition-colors font-bold"
                                                            >
                                                                <ExternalLink className="w-3 h-3" />
                                                                {display}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4 lg:border-l lg:border-gray-100 lg:pl-8">
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-[#D2B589] uppercase font-black tracking-widest">Recommended Actions</p>
                                            <ul className="space-y-3">
                                                {inc.recommendedActions?.map((action, idx) => (
                                                    <li key={idx} className="flex items-start gap-3 bg-gray-50/50 p-2.5 rounded-sm border border-gray-100">
                                                        <ShieldCheck className="w-4 h-4 text-[#0E6246] mt-0.5 shrink-0" />
                                                        <span className="text-[13px] text-gray-700 font-sans">{action}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>))}
                </div>
            </div>
        </div>
    );
}
