"use client";

import { useState, useEffect, useRef } from 'react';
import { ThoughtTrace } from '@/components/ThoughtTrace';
import { IncidentReport } from '@/components/IncidentReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Shield, Radio, Power, Box, Cpu, Workflow, Activity, User, Target, BookOpen, Plus, X } from 'lucide-react';
import { AgentThought, ScanReport } from '@/types';

// Type for the dynamic agent config
type AgentConfigItem = {
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
  llm: string;
  verbose: boolean;
  allow_delegation: boolean;
};

type AgentsConfigStruct = {
  [agentName: string]: AgentConfigItem;
};

export default function Home() {
  const [asset, setAsset] = useState('SonicWall Next-Generation Firewall');
  const [attributes, setAttributes] = useState<{ key: string, value: string }[]>([
    { key: 'Hardware Model', value: 'SonicWall NSA 3650' },
    { key: 'Firmware Version', value: 'SonicOS 7.0.1-5050' },
    { key: 'Exposed Services', value: 'SSL VPN, HTTPS Management' }
  ]);

  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle');
  const [isGeneratingAgents, setIsGeneratingAgents] = useState(false);
  const [agentsConfig, setAgentsConfig] = useState<AgentsConfigStruct | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [report, setReport] = useState<ScanReport | null>(null);

  const [sessionId, setSessionId] = useState<string>('');
  const [sessionHistory, setSessionHistory] = useState<{ id: string, name: string, timestamp: string }[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const loadSessions = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/sessions`);
      if (resp.ok) {
        const data = await resp.json();
        setSessionHistory(data.sessions || []);
      }
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setIsHistoryLoaded(true);
    }
  };

  useEffect(() => {
    // Generate session ID purely on client-side to avoid hydration mismatch
    let currentId = localStorage.getItem('currentSessionId');
    if (!currentId) {
      currentId = crypto.randomUUID();
      localStorage.setItem('currentSessionId', currentId);
    }
    setSessionId(currentId);

    // Try to auto-load existing scan report
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${API_URL}/api/scan-report?sessionId=${currentId}`)
      .then(r => r.json())
      .then(report => {
        if (report && Object.keys(report).length > 0) {
          setReport(report);
          setStatus('finished');
        }
      })
      .catch(e => console.error("Initial report load failed", e));

    // Try to auto-load the thought trace
    fetch(`${API_URL}/api/thought-trace?sessionId=${currentId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setThoughts(data);
        }
      })
      .catch(e => console.error("Initial thought trace load failed", e));

    // Load historical sessions
    loadSessions();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startNewSession = () => {
    const newId = crypto.randomUUID();
    setSessionId(newId);
    localStorage.setItem('currentSessionId', newId);

    // Clear UI state
    setAgentsConfig(null);
    setIsEditingConfig(false);
    setThoughts([]);
    setReport(null);
    setStatus('idle');
  };

  // When switching a session from history
  const switchSession = async (id: string) => {
    setSessionId(id);
    localStorage.setItem('currentSessionId', id);

    // Clear display state, keep the form mostly as is or ready to fetch new agents
    setThoughts([]);
    setReport(null);
    setStatus('idle');
    setIsEditingConfig(false);
    setAgentsConfig(null);

    // Try to auto-load its config so you can view/edit it
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/agents-config?sessionId=${id}`);
      if (resp.ok) {
        const config = await resp.json();
        if (config && Object.keys(config).length > 0) {
          setAgentsConfig(config);
          setIsEditingConfig(true);
        }
      }
    } catch (e) {
      console.error("Config fetch error:", e);
    }

    // Try to auto-load existing scan report
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/scan-report?sessionId=${id}`);
      if (resp.ok) {
        const rep = await resp.json();
        if (rep && Object.keys(rep).length > 0) {
          setReport(rep);
          setStatus('finished');
        }
      }
    } catch (e) {
      console.error("Report fetch error:", e);
    }

    // Try to auto-load existing thought trace
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/thought-trace?sessionId=${id}`);
      if (resp.ok) {
        const traceData = await resp.json();
        if (Array.isArray(traceData) && traceData.length > 0) {
          setThoughts(traceData);
        }
      }
    } catch (e) {
      console.error("Thought trace fetch error:", e);
    }
  };

  const generateAgents = async () => {
    setIsGeneratingAgents(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/generate-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          attributes: Object.fromEntries(attributes.filter(a => a.key && a.value).map(a => [a.key, a.value])),
          sessionId
        })
      });

      if (!resp.ok) throw new Error("Agent Generation Error");

      const data = await resp.json();
      setAgentsConfig(data.config);
      setIsEditingConfig(true);
      alert("Agents configured successfully! You can now review and tweak them.");
      loadSessions();
    } catch (err) {
      console.error(err);
      alert("Failed to generate agents. Ensure backend is running.");
    } finally {
      setIsGeneratingAgents(false);
    }
  };

  const saveConfig = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/agents-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentsConfig)
      });
      if (!resp.ok) throw new Error("Failed to save config");
      alert("Configuration saved successfully!");
      setIsEditingConfig(false);
    } catch (e) {
      console.error(e);
      alert("Error saving configuration.");
    }
  };

  const editAgents = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/agents-config?sessionId=${sessionId}`);
      if (!resp.ok) throw new Error("Failed to fetch existing config");
      const config = await resp.json();

      if (Object.keys(config).length === 0) {
        alert("No configuration found. Please generate agents first.");
        return;
      }

      setAgentsConfig(config);
      setIsEditingConfig(true);
    } catch (e) {
      console.error(e);
      alert("Failed to load configuration. Is the backend running?");
    }
  };

  const startScan = async () => {
    setThoughts([]);
    setReport(null);
    setStatus('running');

    // Setup WebSocket for real-time trace
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${WS_URL}/ws/scan/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'thought') {
          setThoughts(prev => [...prev, data]);
        } else if (data.type === 'finish') {
          // The background task has finished generating the report.
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
          const reportResp = await fetch(`${API_URL}/api/scan-report?sessionId=${sessionId}`);
          if (reportResp.ok) {
            const finalReport = await reportResp.json();
            setReport(finalReport);
            setStatus('finished');
          } else {
            setStatus('idle');
            alert("Scan completed but failed to fetch the final report.");
          }
          ws.close();
        }
      } catch (e) {
        console.error("WS Parse Error:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("WS Connection Error:", e);
      setStatus('idle');
      alert("WebSocket connection error. The scan might still be running.");
    };

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          attributes: Object.fromEntries(attributes.filter(a => a.key && a.value).map(a => [a.key, a.value])),
          sessionId
        })
      });

      if (!resp.ok) {
        throw new Error("Scan Engine Error");
      }

      // We don't wait for the report here anymore. 
      // The API returns 202 Accepted instantly, and the WS handles completion.

    } catch (err) {
      console.error(err);
      setStatus('idle');
      alert("Failed to initialize scan. Ensure backend is running.");
      ws.close();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 selection:bg-[#D2B589]/30 overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">



      </div>

      <div className="container mx-auto max-w-7xl pt-12 pb-24 px-6 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#19314B]/10">
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[#19314B] flex items-center gap-4 uppercase">
              THREAT
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D2B589] to-[#b39566]">
                INTEL
              </span>
              <Shield className="w-8 h-8 md:w-10 md:h-10 text-[#0E6246]" />
            </h1>
            <div className="text-gray-500 font-sans tracking-wide text-xs uppercase pl-1 flex items-center gap-4 mt-2">
              Autonomous Intelligence System
              {sessionId &&
                <div className="flex items-center gap-2 ml-2">
                  <span className="flex items-center gap-2 font-bold border border-gray-200 bg-white shadow-sm px-3 py-1.5 rounded-none">
                    <Activity className="w-3.5 h-3.5 text-[#D2B589]" />
                    <span className="tracking-wide text-[#19314B]">
                      {!isHistoryLoaded
                        ? 'LOADING...'
                        : (sessionHistory.find(s => s.id === sessionId)?.name?.toUpperCase() || `${asset.replace(/[^a-zA-Z0-9]/g, '')}_Analysis_${sessionId.split('-')[0]}`.toUpperCase())}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startNewSession}
                    className="h-8 px-3 text-[10px] bg-white hover:bg-gray-50 border-gray-200 text-[#19314B] rounded-none shadow-sm transition-all font-bold tracking-widest"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-[#0E6246]" />
                    NEW SESSION
                  </Button>
                </div>
              }
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {sessionHistory.length > 0 && (
              <select
                value={sessionId}
                onChange={(e) => switchSession(e.target.value)}
                className="bg-white border border-[#19314B]/30 text-[#19314B] font-sans font-bold text-xs p-2 rounded outline-none w-48 shadow-sm"
              >
                <option value={sessionId} disabled>-- Select Session History --</option>
                {sessionHistory.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({new Date(s.timestamp).toLocaleTimeString()})</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-6 bg-white p-2 px-6 rounded border border-gray-200 shadow-md">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-[#D2B589] animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-[10px] font-sans font-bold uppercase text-gray-500">System Ready</span>
              </div>
              <div className="w-[1px] h-4 bg-gray-200" />
              <div className="flex items-center gap-2 text-[#19314B] font-bold text-sm">
                <Activity className="w-4 h-4 text-[#0E6246]" />
                <span className="tracking-tight uppercase">Operational</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-8">
          {/* Left Panel: Configuration & Trace */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-none">
              <div className="h-1 w-full bg-[#19314B]" />
              <CardHeader className="border-b border-gray-100 pb-4 bg-gray-50/50">
                <CardTitle className="text-xs uppercase tracking-widest font-bold text-[#19314B] flex items-center gap-2">
                  <Power className="w-4 h-4 text-[#D2B589]" />
                  Target Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-1.5 mb-4">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2 ml-1">
                    <Box className="w-3 h-3 text-[#19314B]" /> Primary Asset Focus
                  </label>
                  <Input
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="bg-gray-50 border-gray-200 focus:border-[#19314B] text-[#19314B] font-sans font-bold text-sm h-12 transition-all rounded-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center justify-between ml-1">
                    <span className="flex items-center gap-2"><Cpu className="w-3 h-3 text-[#19314B]" /> Specific Details</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttributes([...attributes, { key: '', value: '' }])}
                      className="h-6 px-2 text-[10px] text-[#D2B589] hover:text-[#19314B] hover:bg-gray-100 uppercase rounded-none"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Detail
                    </Button>
                  </label>

                  <div className="space-y-2">
                    {attributes.map((attr, idx) => (
                      <div key={idx} className="flex gap-2 items-center group">
                        <Input
                          placeholder="e.g. Firmware"
                          value={attr.key}
                          onChange={(e) => {
                            const newAttrs = [...attributes];
                            newAttrs[idx].key = e.target.value;
                            setAttributes(newAttrs);
                          }}
                          className="bg-gray-50 w-1/3 border-gray-200 focus:border-[#19314B] text-gray-600 font-sans text-xs h-10 rounded-none"
                        />
                        <Input
                          placeholder="e.g. v7.0.1"
                          value={attr.value}
                          onChange={(e) => {
                            const newAttrs = [...attributes];
                            newAttrs[idx].value = e.target.value;
                            setAttributes(newAttrs);
                          }}
                          className="bg-gray-50 flex-1 border-gray-200 focus:border-[#19314B] text-[#19314B] font-sans font-bold text-xs h-10 rounded-none"
                        />
                        <button
                          onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))}
                          className="text-gray-600 hover:text-red-500 transition-colors p-1 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-8">
                  <div className="flex gap-3">
                    <Button
                      onClick={generateAgents}
                      disabled={status === 'running' || isGeneratingAgents}
                      variant="outline"
                      className="flex-1 h-12 border-[#19314B] text-[#19314B] hover:bg-[#19314B] hover:text-white font-bold tracking-wider uppercase transition-all bg-transparent rounded-none"
                    >
                      {isGeneratingAgents ? 'Synthesizing...' : 'Generate Agents'}
                    </Button>
                    <Button
                      onClick={editAgents}
                      disabled={status === 'running' || isGeneratingAgents}
                      variant="outline"
                      className="flex-1 h-12 border-[#D2B589] text-[#D2B589] hover:bg-[#D2B589] hover:text-white font-bold tracking-wider uppercase transition-all bg-transparent rounded-none"
                    >
                      Edit Agents
                    </Button>
                  </div>

                  <Button
                    onClick={startScan}
                    disabled={status === 'running' || isGeneratingAgents}
                    className="w-full h-14 bg-[#0E6246] hover:bg-[#0acc74] text-white font-black tracking-widest uppercase shadow-lg transition-all duration-300 disabled:opacity-50 rounded-none mt-2"
                  >
                    {status === 'running' ? 'Scanning...' : 'Initialize Analysis'}
                  </Button>
                </div>
              </CardContent>
            </Card>


          </div>

          {/* Right Panel: Analysis Display */}
          <div className="lg:col-span-8 flex flex-col min-h-[850px]">
            {/* Thought Trace Component at the top of the Right Panel */}
            <div className="mb-6 w-full">
              <ThoughtTrace thoughts={thoughts} />
            </div>

            {isEditingConfig && agentsConfig && (
              <Card className="flex-1 flex flex-col bg-white border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500 rounded-none">
                <CardHeader className="border-b border-gray-100 pb-6 shrink-0 bg-gray-50/50">
                  <CardTitle className="text-sm uppercase tracking-[0.2em] font-black text-[#19314B] flex items-center gap-3">
                    <Activity className="w-5 h-5 text-[#0E6246]" />
                    Agent_Configuration_Editor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex flex-col flex-1 space-y-6 overflow-y-auto max-h-[700px] custom-scrollbar">
                  <div className="space-y-8">
                    {Object.entries(agentsConfig).map(([agentId, config]) => (
                      <div key={agentId} className="bg-white border border-gray-200 shadow-sm p-5 space-y-5 relative overflow-hidden group">
                        {/* Subtle background glow per agent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-[50px] transition-colors duration-1000" />

                        <h3 className="text-lg font-black tracking-widest text-[#19314B] uppercase border-b border-gray-100 pb-2 mb-4">
                          Agent:: {agentId}
                        </h3>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[#19314B]" />
                            Role Definition
                          </label>
                          <textarea
                            value={config.role}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, role: e.target.value }
                            })}
                            className="w-full min-h-[60px] bg-gray-50 border border-gray-200 focus:border-[#19314B]/50 text-gray-800 font-mono text-[13px] p-3 rounded-none outline-none transition-all resize-y"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-[#0E6246]" />
                            Objective / Goal
                          </label>
                          <textarea
                            value={config.goal}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, goal: e.target.value }
                            })}
                            className="w-full min-h-[100px] bg-gray-50 border border-gray-200 focus:border-[#19314B]/50 text-gray-800 font-mono text-[13px] p-3 rounded-none outline-none transition-all resize-y"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-[#D2B589]" />
                            System Backstory
                          </label>
                          <textarea
                            value={config.backstory}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, backstory: e.target.value }
                            })}
                            className="w-full min-h-[140px] bg-gray-50 border border-gray-200 focus:border-[#19314B]/50 text-gray-800 font-mono text-[13px] p-3 rounded-none outline-none transition-all resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 shrink-0 pt-4 border-t border-gray-100 sticky bottom-0 bg-white/95 backdrop-blur-md pb-2 z-10">
                    <Button onClick={() => setIsEditingConfig(false)} variant="outline" className="flex-1 h-14 bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-[#19314B] uppercase tracking-widest font-bold rounded-none">
                      Discard Changes
                    </Button>
                    <Button onClick={saveConfig} className="flex-1 h-14 bg-[#19314B] hover:bg-[#19314B]/90 text-white font-black tracking-widest uppercase rounded-none shadow-sm">
                      Save & Finalize Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {status === 'idle' && !isEditingConfig && (
              <div className="flex-1 flex flex-col items-center justify-center border border-gray-200 bg-white shadow-sm rounded-none animate-in fade-in zoom-in-95 duration-1000">
                <div className="relative mb-8">
                  <Shield className="w-20 h-20 text-gray-100 drop-shadow-sm" />
                  <Shield className="w-20 h-20 text-[#19314B] absolute inset-0 animate-pulse opacity-20" />
                </div>
                <p className="text-gray-400 font-sans font-bold text-[10px] uppercase tracking-[0.4em]">Awaiting Uplink Initialization...</p>
              </div>
            )}

            {status === 'running' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-10 py-20 bg-gray-50 rounded-none border border-gray-200">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-t-2 border-r-2 border-[#19314B]/20 animate-spin" />
                  <div className="absolute inset-0 w-32 h-32 rounded-full border-b-2 border-l-2 border-[#D2B589]/40 animate-[spin_3s_linear_infinite]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Radio className="w-10 h-10 text-[#0E6246] animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl font-black italic tracking-tighter text-[#19314B] uppercase">Reconnaissance in Progress</h2>
                  <p className="text-gray-500 font-sans font-bold text-[10px] uppercase tracking-[0.25em] max-w-md mx-auto leading-loose">
                    Agents are traversing CVE databases and vendor advisories. Real-time thought trace is active.
                  </p>
                </div>
              </div>
            )}

            {status === 'finished' && report && (
              <IncidentReport report={report} sessionId={sessionId} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
