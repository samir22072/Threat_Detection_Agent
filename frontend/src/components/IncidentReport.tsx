"use client";

import { ScanReport } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Activity, Search, ExternalLink } from "lucide-react";

interface IncidentReportProps {
    report: ScanReport;
}

export function IncidentReport({ report }: IncidentReportProps) {
    const { summary, incidents, executiveSummary } = report;

    const getRiskColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'critical': return 'text-fuchsia-500 brightness-125';
            case 'high': return 'text-red-500';
            case 'medium': return 'text-yellow-500';
            default: return 'text-cyan-400';
        }
    };

    const getSeverityBadge = (severity: string) => {
        const s = severity?.toLowerCase();
        if (s === 'critical') return 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30';
        if (s === 'high') return 'bg-red-500/10 text-red-400 border-red-500/30';
        if (s === 'medium') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    };

    return (
        <div className="space-y-10 animate-in fade-in zoom-in-95 duration-1000">
            {/* Executive Summary Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Overall Risk", value: executiveSummary.overallRiskLevel, icon: Activity, color: getRiskColor(executiveSummary.overallRiskLevel) },
                    { label: "Total Threats", value: summary.totalIncidents, icon: AlertTriangle, color: "text-zinc-100" },
                    { label: "Critical", value: summary.criticalCount, icon: ShieldCheck, color: "text-fuchsia-500" },
                    { label: "Research Coverage", value: "DEEP", icon: Search, color: "text-cyan-400" },
                ].map((item, i) => (
                    <Card key={i} className="bg-zinc-950/40 border-cyan-500/10 backdrop-blur-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                            <item.icon className="w-12 h-12" />
                        </div>
                        <CardContent className="pt-6">
                            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">{item.label}</p>
                            <div className={`text-2xl font-bold tracking-tight ${item.color}`}>
                                {item.value}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Executive Summary Details */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-6 bg-cyan-500 shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                    <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Executive Summary</h3>
                </div>
                <Card className="bg-zinc-950/30 border-zinc-800/50">
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Business Impact</p>
                            <p className="text-[14px] text-zinc-300 leading-relaxed font-mono">
                                {executiveSummary.businessImpact}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Key Findings</p>
                                <ul className="space-y-2">
                                    {executiveSummary.keyFindings?.map((finding, idx) => (
                                        <li key={idx} className="text-[13px] text-zinc-400 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-yellow-500/70 mt-0.5" />
                                            <span className="leading-snug">{finding}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Immediate Actions Required</p>
                                <ul className="space-y-2">
                                    {executiveSummary.immediateActions?.map((action, idx) => (
                                        <li key={idx} className="text-[13px] text-zinc-400 flex items-start gap-2">
                                            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-cyan-500/70 mt-0.5" />
                                            <span className="leading-snug">{action}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Incidents Drilldown */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-6 bg-cyan-500 shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                    <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Impact Analysis Report</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {incidents.map((inc, i) => (
                        <Card key={i} className="bg-zinc-950/30 border-zinc-800/50 hover:border-cyan-500/20 transition-all duration-300 group">
                            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-900/50 bg-white/[0.01]">
                                <CardTitle className="text-lg font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors">
                                    {inc.incident}
                                </CardTitle>
                                <Badge className={`${getSeverityBadge(inc.severity)} font-mono uppercase tracking-tighter`}>
                                    {inc.severity}
                                </Badge>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Technical Impact</p>
                                            <p className="text-[13px] text-zinc-400 leading-relaxed font-mono">
                                                {inc.impactAnalysis}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {inc.cve?.map(c => (
                                                <Badge key={c} variant="secondary" className="bg-zinc-900 text-[10px] font-mono border-zinc-800">
                                                    {c}
                                                </Badge>
                                            ))}
                                        </div>
                                        {inc.sourceLinks && inc.sourceLinks.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
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
                                                                className="text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 border border-cyan-900/30 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors"
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

                                    <div className="bg-cyan-500/[0.02] p-5 rounded-lg border border-zinc-800/40 shadow-inner">
                                        <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            Priority Remediation Protocol
                                        </p>
                                        <ul className="space-y-3">
                                            {inc.recommendedActions.map((action, j) => (
                                                <li key={j} className="text-[12px] text-zinc-300 flex items-start gap-3">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mt-1.5 flex-shrink-0" />
                                                    <span className="leading-snug">{action}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
