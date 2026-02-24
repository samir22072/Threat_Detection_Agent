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
        <div className={`flex flex-col border border-gray-200 bg-white shadow-sm overflow-hidden transition-all duration-300 rounded-none ${isExpanded ? 'h-[400px]' : 'h-[48px]'}`}>
            <div
                className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-[#19314B] font-bold font-sans text-sm tracking-wider uppercase">
                    <Terminal className="w-4 h-4 text-[#0E6246]" />
                    <span>Agent Activity Log</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 font-sans uppercase font-bold tracking-widest">
                        {thoughts.length} Events
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#19314B]" /> : <ChevronDown className="w-4 h-4 text-[#19314B]" />}
                </div>
            </div>

            {isExpanded && (
                <ScrollArea className="flex-1 p-4 min-h-0 relative overflow-y-auto">
                    <div className="space-y-6">
                        {thoughts.length === 0 && (
                            <p className="text-gray-400 font-sans px-2 text-sm italic">System idle. Awaiting initialization log...</p>
                        )}
                        {thoughts.map((thought, i) => (
                            <div key={i} className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex items-center justify-between pl-1">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest font-sans py-0 h-4 border-gray-200 text-[#19314B] bg-gray-50 rounded-sm">
                                        {thought.agent}
                                    </Badge>
                                    <span className="text-[10px] text-gray-400 font-sans tracking-widest">
                                        {mounted ? new Date(thought.timestamp).toLocaleTimeString() : "--:--:--"}
                                    </span>
                                </div>
                                <div className="pl-3 border-l-2 border-gray-200 mt-2 space-y-3">
                                    <div className="text-gray-700 font-sans text-[13px] leading-relaxed overflow-x-auto custom-scrollbar pr-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-[#0E6246] font-bold select-none text-lg leading-none mt-[-2px]">&middot;</span>
                                            <div className="flex-1 min-w-0 break-words space-y-2">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                                        a: ({ node, ...props }) => <a className="text-[#D2B589] hover:text-[#19314B] hover:underline transition-colors font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
                                                        code: ({ node, inline, ...props }: any) =>
                                                            inline
                                                                ? <code className="bg-gray-100 text-[#19314B] px-1 py-0.5 rounded-sm font-mono text-[11px] font-bold" {...props} />
                                                                : <code className="block bg-gray-50 p-3 text-[#19314B] text-[12px] font-mono overflow-x-auto border border-gray-200 my-2" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc space-y-1 mb-2 ml-4 text-gray-600" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 mb-2 text-gray-600" {...props} />,
                                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                        h1: ({ node, ...props }) => <h1 className="text-sm font-black text-[#19314B] mt-4 mb-2 uppercase tracking-widest" {...props} />,
                                                        h2: ({ node, ...props }) => <h2 className="text-[13px] font-bold text-[#19314B] mt-3 mb-2" {...props} />,
                                                        h3: ({ node, ...props }) => <h3 className="text-[12px] font-bold text-gray-800 mt-2 mb-1 border-b border-gray-100 pb-1" {...props} />,
                                                        blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-[#D2B589] pl-3 italic text-gray-500 my-2 bg-gray-50 py-1" {...props} />
                                                    }}
                                                >
                                                    {thought.thought}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    </div>
                                    {thought.action && (
                                        <div className="flex items-start gap-3 bg-gray-50 p-3 border border-gray-200 shadow-sm mt-3">
                                            <div className="bg-white border border-gray-200 p-1.5 shadow-sm">
                                                <Zap className="w-3.5 h-3.5 text-[#D2B589]" />
                                            </div>
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <p className="text-[10px] text-[#19314B] uppercase font-black tracking-widest">Tool Invocation: {thought.action}</p>
                                                <pre className="text-[11px] text-gray-700 whitespace-pre-wrap break-all font-mono leading-tight bg-white border border-gray-200 p-2 shadow-inner">
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
