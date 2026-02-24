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

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'thought') {
          setThoughts(prev => [...prev, data]);
        }
      } catch (e) {
        console.error("WS Parse Error:", e);
      }
    };

    ws.onerror = (e) => console.error("WS Connection Error:", e);

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

      if (!resp.ok) throw new Error("Scan Engine Error");

      const result = await resp.json();
      setReport(result);
      setStatus('finished');
    } catch (err) {
      console.error(err);
      setStatus('idle');
      alert("Scan failed. Ensure backend is running.");
    } finally {
      ws.close();
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] bg-fuchsia-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <div className="container mx-auto max-w-7xl pt-12 pb-24 px-6 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic flex items-center gap-4 justify-center md:justify-start">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent">
                CYBER THREAT COMMAND
              </span>
              <Shield className="w-8 h-8 md:w-10 md:h-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
            </h1>
            <p className="text-zinc-500 font-mono tracking-widest text-[10px] uppercase pl-1 flex items-center gap-4 mt-2">
              Multi-Agent Autonomous Intelligence System // v3.0-PREMIUM
              {sessionId &&
                <span className="flex items-center gap-2 text-cyan-500 font-bold border border-cyan-900/40 bg-cyan-950/20 px-2 py-1 rounded">
                  <Activity className="w-3 h-3" />
                  <span className="tracking-wide">
                    {sessionHistory.find(s => s.id === sessionId)?.name?.toUpperCase() || `${asset.replace(/[^a-zA-Z0-9]/g, '')}_Analysis_${sessionId.split('-')[0]}`.toUpperCase()}
                  </span>
                  <Button variant="ghost" size="sm" onClick={startNewSession} className="h-5 px-2 ml-2 text-[10px] bg-cyan-900/40 hover:bg-cyan-800 text-white rounded">
                    <Plus className="w-3 h-3 mr-1" /> NEW
                  </Button>
                </span>
              }
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {sessionHistory.length > 0 && (
              <select
                value={sessionId}
                onChange={(e) => switchSession(e.target.value)}
                className="bg-black/40 border border-zinc-800 text-cyan-300 font-mono text-[10px] p-2 rounded outline-none w-48 shadow-lg shadow-black/20"
              >
                <option value={sessionId} disabled>-- Select Session History --</option>
                {sessionHistory.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({new Date(s.timestamp).toLocaleTimeString()})</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-6 bg-zinc-950/40 p-1.5 px-5 rounded-full border border-zinc-800/50 backdrop-blur-md shadow-lg shadow-black/20">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-cyan-500 animate-pulse' : 'bg-cyan-500/20'}`} />
                <span className="text-[10px] font-mono uppercase text-zinc-400">Core_Engine</span>
              </div>
              <div className="w-[1px] h-4 bg-zinc-800" />
              <div className="flex items-center gap-2 text-zinc-300 font-black text-sm">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="tracking-tight">READY_FOR_COMM</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Configuration & Trace */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-zinc-950/60 border-cyan-500/20 backdrop-blur-xl shadow-2xl shadow-cyan-500/5 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600" />
              <CardHeader className="border-b border-zinc-900/50 pb-4">
                <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-cyan-400/80 flex items-center gap-2">
                  <Power className="w-4 h-4 text-cyan-500" />
                  Target_Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-1.5 mb-4">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center gap-2 ml-1">
                    <Box className="w-3 h-3 text-cyan-700" /> Primary Asset Focus
                  </label>
                  <Input
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="bg-black/30 border-zinc-800 focus:border-cyan-500/50 text-cyan-100 font-mono text-sm placeholder:text-zinc-700 h-10 transition-all font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center justify-between ml-1">
                    <span className="flex items-center gap-2"><Cpu className="w-3 h-3 text-cyan-700" /> Specific Details</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttributes([...attributes, { key: '', value: '' }])}
                      className="h-6 px-2 text-[10px] text-cyan-500 hover:text-cyan-400 hover:bg-cyan-950/30"
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
                          className="bg-black/30 w-1/3 border-zinc-800 focus:border-cyan-500/50 text-cyan-300/70 font-mono text-[11px] h-9"
                        />
                        <Input
                          placeholder="e.g. v7.0.1"
                          value={attr.value}
                          onChange={(e) => {
                            const newAttrs = [...attributes];
                            newAttrs[idx].value = e.target.value;
                            setAttributes(newAttrs);
                          }}
                          className="bg-black/30 flex-1 border-zinc-800 focus:border-cyan-500/50 text-cyan-100 font-mono text-[12px] h-9"
                        />
                        <button
                          onClick={() => setAttributes(attributes.filter((_, i) => i !== idx))}
                          className="text-zinc-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  <div className="flex gap-3">
                    <Button
                      onClick={generateAgents}
                      disabled={status === 'running' || isGeneratingAgents}
                      variant="outline"
                      className="flex-1 h-11 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10 hover:text-fuchsia-300 font-bold tracking-wider uppercase transition-all bg-transparent"
                    >
                      {isGeneratingAgents ? 'Synthesizing...' : 'Generate Agents'}
                    </Button>
                    <Button
                      onClick={editAgents}
                      disabled={status === 'running' || isGeneratingAgents}
                      variant="outline"
                      className="flex-1 h-11 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 font-bold tracking-wider uppercase transition-all bg-transparent"
                    >
                      Edit Agents
                    </Button>
                  </div>

                  <Button
                    onClick={startScan}
                    disabled={status === 'running' || isGeneratingAgents}
                    className="w-full h-11 bg-gradient-to-br from-cyan-600 via-blue-700 to-indigo-800 hover:brightness-110 text-white font-black tracking-widest uppercase italic shadow-[0_4px_20px_rgba(0,149,255,0.3)] hover:shadow-[0_8px_30px_rgba(0,149,255,0.5)] transition-all duration-500 disabled:opacity-50 border border-cyan-400/20"
                  >
                    {status === 'running' ? 'Neutralizing...' : 'Initialize Scan'}
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
              <Card className="flex-1 flex flex-col bg-zinc-950/60 border-cyan-500/20 backdrop-blur-xl shadow-2xl shadow-cyan-500/5 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="border-b border-zinc-900/50 pb-6 shrink-0 bg-black/40">
                  <CardTitle className="text-sm uppercase tracking-[0.2em] font-black text-cyan-400/80 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-cyan-500" />
                    Agent_Configuration_Editor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex flex-col flex-1 space-y-6 overflow-y-auto max-h-[700px] custom-scrollbar">
                  <div className="space-y-8">
                    {Object.entries(agentsConfig).map(([agentId, config]) => (
                      <div key={agentId} className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 space-y-5 relative overflow-hidden group">
                        {/* Subtle background glow per agent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[50px] group-hover:bg-fuchsia-500/5 transition-colors duration-1000" />

                        <h3 className="text-lg font-black tracking-widest text-fuchsia-400 uppercase border-b border-zinc-800 pb-2 mb-4">
                          Agent:: {agentId}
                        </h3>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-cyan-500" />
                            Role Definition
                          </label>
                          <textarea
                            value={config.role}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, role: e.target.value }
                            })}
                            className="w-full min-h-[60px] bg-black/50 border border-zinc-800 focus:border-cyan-500/50 text-cyan-50 font-mono text-[13px] p-3 rounded-md outline-none transition-all resize-y"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-blue-500" />
                            Objective / Goal
                          </label>
                          <textarea
                            value={config.goal}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, goal: e.target.value }
                            })}
                            className="w-full min-h-[100px] bg-black/50 border border-zinc-800 focus:border-cyan-500/50 text-cyan-50 font-mono text-[13px] p-3 rounded-md outline-none transition-all resize-y"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-fuchsia-500" />
                            System Backstory
                          </label>
                          <textarea
                            value={config.backstory}
                            onChange={(e) => setAgentsConfig({
                              ...agentsConfig,
                              [agentId]: { ...config, backstory: e.target.value }
                            })}
                            className="w-full min-h-[140px] bg-black/50 border border-zinc-800 focus:border-cyan-500/50 text-cyan-50 font-mono text-[13px] p-3 rounded-md outline-none transition-all resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 shrink-0 pt-4 border-t border-zinc-900/50 sticky bottom-0 bg-zinc-950/90 backdrop-blur-md pb-2 z-10">
                    <Button onClick={() => setIsEditingConfig(false)} variant="outline" className="flex-1 h-14 bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white uppercase tracking-widest font-bold">
                      Discard Changes
                    </Button>
                    <Button onClick={saveConfig} className="flex-1 h-14 bg-cyan-600 hover:bg-cyan-500 text-white font-black tracking-widest uppercase border border-cyan-400 shadow-[0_0_15px_rgba(0,149,255,0.3)]">
                      Save & Finalize Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {status === 'idle' && !isEditingConfig && (
              <div className="flex-1 flex flex-col items-center justify-center border border-zinc-800/50 rounded-2xl bg-zinc-950/20 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-1000">
                <div className="relative mb-8">
                  <Shield className="w-20 h-20 text-zinc-900 drop-shadow-[0_0_15px_rgba(0,0,0,1)]" />
                  <Shield className="w-20 h-20 text-cyan-900 absolute inset-0 animate-pulse opacity-20" />
                </div>
                <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-[0.4em]">Awaiting Uplink Initialization...</p>
              </div>
            )}

            {status === 'running' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-10 py-20 bg-zinc-950/10 rounded-2xl border border-cyan-500/5">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-t-2 border-r-2 border-cyan-500/80 animate-spin" />
                  <div className="absolute inset-0 w-32 h-32 rounded-full border-b-2 border-l-2 border-fuchsia-500/40 animate-[spin_3s_linear_infinite]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Radio className="w-10 h-10 text-cyan-400 animate-pulse shadow-cyan-500/50" />
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">Reconnaissance in Progress</h2>
                  <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.25em] max-w-md mx-auto leading-loose">
                    Agents are traversing CVE databases and vendor advisories. Real-time thought trace is active.
                  </p>
                </div>
              </div>
            )}

            {status === 'finished' && report && (
              <IncidentReport report={report} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
