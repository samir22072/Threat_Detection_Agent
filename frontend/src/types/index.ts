export interface AgentThought {
    type: 'thought';
    agent: string;
    thought: string;
    action?: string;
    tool_input?: string;
    timestamp: string;
}

export interface Incident {
    asset: string;
    incident: string;
    incidentDate: string;
    source: string;
    severity: string;
    cve: string[];
    sourceLinks?: string[];
    doesAffectOrg: boolean;
    impactAnalysis: string;
    recommendedActions: string[];
}

export interface ScanReport {
    summary: {
        scanDate: string;
        timeWindow: string;
        totalIncidents: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
    };
    incidents: Incident[];
    executiveSummary: {
        overallRiskLevel: string;
        keyFindings: string[];
        businessImpact: string;
        immediateActions: string[];
    };
    references: Record<string, string>;
}
