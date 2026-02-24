"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentThought } from "@/types";
import { Terminal, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

import { useState, useEffect } from "react";

interface ThoughtTraceProps {
    thoughts: AgentThought[];
}

export function ThoughtTrace({ thoughts }: ThoughtTraceProps) {
    const [mounted, setMounted] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className={`flex flex-col border rounded-lg bg-black/40 backdrop-blur-md border-cyan-500/20 shadow-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'h-[400px]' : 'h-[48px]'}`}>
            <div
                className="flex items-center justify-between p-3 border-b border-cyan-500/20 bg-cyan-950/20 cursor-pointer hover:bg-cyan-950/40 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm">
                    <Terminal className="w-4 h-4" />
                    <span>AGENT_THOUGHT_TRACE_FEED</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono">
                        {thoughts.length} Events Logged
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-500" /> : <ChevronDown className="w-4 h-4 text-cyan-500" />}
                </div>
            </div>

            {isExpanded && (
                <ScrollArea className="flex-1 p-4 min-h-0 relative overflow-y-auto">
                    <div className="space-y-6">
                        {thoughts.length === 0 && (
                            <p className="text-zinc-500 font-mono text-xs italic">Waiting for agents to initiate research protocol...</p>
                        )}
                        {thoughts.map((thought, i) => (
                            <div key={i} className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 h-4 border-cyan-500/30 text-cyan-400 bg-cyan-950/10">
                                        {thought.agent}
                                    </Badge>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        {mounted ? new Date(thought.timestamp).toLocaleTimeString() : "--:--:--"}
                                    </span>
                                </div>
                                <div className="pl-3 border-l-2 border-zinc-800/50 space-y-3">
                                    <div className="text-zinc-300 font-mono text-[13px] leading-relaxed overflow-x-auto custom-scrollbar pr-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-cyan-600 font-bold select-none">&gt;</span>
                                            <div className="flex-1 min-w-0 break-words space-y-2">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                        a: ({ node, ...props }) => <a className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                                        code: ({ node, inline, ...props }: any) =>
                                                            inline
                                                                ? <code className="bg-zinc-800/80 text-cyan-200 px-1 py-0.5 rounded text-[11px]" {...props} />
                                                                : <code className="block bg-black/60 p-3 rounded-md text-cyan-100/90 text-[11px] overflow-x-auto border border-zinc-800/50 my-2 shadow-inner" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-none space-y-1 mb-2 ml-1" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 mb-2 text-zinc-400" {...props} />,
                                                        li: ({ node, ...props }) => (
                                                            <li className="flex items-start gap-2" {...props}>
                                                                <span className="text-cyan-600 mt-1.5 text-[8px]">■</span>
                                                                <span className="flex-1">{props.children}</span>
                                                            </li>
                                                        ),
                                                        h1: ({ node, ...props }) => <h1 className="text-sm font-bold text-cyan-400 mt-4 mb-2 uppercase tracking-wide" {...props} />,
                                                        h2: ({ node, ...props }) => <h2 className="text-[13px] font-bold text-cyan-500 mt-3 mb-2" {...props} />,
                                                        h3: ({ node, ...props }) => <h3 className="text-[12px] font-bold text-zinc-200 mt-2 mb-1 border-b border-zinc-800/50 pb-1" {...props} />,
                                                        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-fuchsia-500/50 pl-3 italic text-zinc-400 my-2 bg-fuchsia-950/10 py-1" {...props} />
                                                    }}
                                                >
                                                    {thought.thought}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                    {thought.action && (
                                        <div className="flex items-start gap-3 bg-zinc-900/80 p-3 rounded-md border border-zinc-800/50 shadow-inner">
                                            <div className="bg-yellow-500/10 p-1.5 rounded">
                                                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                                            </div>
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Tool Invocation: {thought.action}</p>
                                                <pre className="text-[11px] text-yellow-500/90 whitespace-pre-wrap break-all font-mono leading-tight bg-black/30 p-2 rounded">
                                                    {thought.tool_input}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
