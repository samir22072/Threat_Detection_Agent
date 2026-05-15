CONFIG_GENERATOR_PROMPT = """You are an expert Cyber Security Architect configuring a multi-agent system.
We have three agents:
1. researcher: Finds recent security incidents and CVEs. Needs tools: ['DateSortedSearchTool', 'ScrapeWebsiteTool']
2. analyst: Evaluates incidents against the config. Needs tools: []
3. summarizer: Generates final JSON report. Needs tools: []

Based on the TARGET ASSET configuration below, generate a highly specialized ROLE, GOAL, and BACKSTORY for each agent to maximize their effectiveness for this specific technology stack.
All agents must use the 'azure_openai' LLM.
'verbose' should be true.
'allow_delegation' should be false.

TARGET ASSET:
{asset_config}

You MUST output ONLY valid JSON matching this exact structure:
{{
  "researcher": {{
    "role": "...",
    "goal": "...",
    "backstory": "...",
    "tools": ["DateSortedSearchTool", "ScrapeWebsiteTool"],
    "llm": "azure_openai",
    "verbose": true,
    "allow_delegation": false
  }},
  "analyst": {{ ... }},
  "summarizer": {{ ... }}
}}
"""

DISCOVERY_TASK_PROMPT = """Find and research relevant security incidents for {{asset}} in the {{timeDuration}}. 

CRITICAL INSTRUCTIONS:
1. QUERY EXPANSION: You MUST run multiple, distinct searches to thoroughly cover the {{timeDuration}}. Do not rely on a single search query returning everything. Use variations (e.g., "[asset] CVE [year]", "[asset] vulnerability advisory", "[asset] exploit").

2. DIVERSE SOURCES: You MUST actively search across multiple different types of sources to prevent blind spots, including but not limited to:
   - Vendor Security Advisories (e.g., official PSIRT pages)
   - Vulnerability Databases (e.g., NVD, MITRE CVE)
   - Exploit Databases and PoC Repositories (e.g., Exploit-DB, GitHub, Packet Storm)
   - Security News and Blogs (e.g., BleepingComputer, The Hacker News, technical deep-dives)
   - Threat Intel Forums & Social Media (e.g., Reddit r/cybersecurity, Twitter/X InfoSec communities)

3. SOURCE VALIDATION AND FALLBACKS: If you find a link, you MUST verify it is a valid, functioning HTTP/HTTPS URL that actually contains the threat intelligence. Do not hallucinate dummy URLs.
   - If a website blocks your ScrapeWebsiteTool or returns an error (e.g., Cloudflare protection, 403 Forbidden), DO NOT GIVE UP on that incident.
   - Instead, immediately run a new search query specifically looking for OTHER security blogs, news sites, or CVE databases that summarize what the blocked site said.
   
4. DETAIL EXTRACTION: For every incident, you MUST extract:
   - The exact Date of discovery or publication (YYYY-MM-DD format)
   - CVE IDs if applicable
   - Affected specific firmware or software versions (e.g., SonicOS 7.0)
   - The specific exploit condition or technical root cause
   - Direct remediation steps (e.g., specific CLI commands or patch links)
   
5. TIME DURATION STRICTNESS: You MUST ONLY report incidents that were published or discovered strictly within the specified {{timeDuration}}. If an incident's date falls outside this time window, you MUST completely ignore and discard it.
{ignored_sources_instruction}"""

DISCOVERY_EXPECTED_OUTPUT = 'A deep technical report resulting from multiple exhaustive searches, including validated source URLs, scraped data, and affected versions. Ensure ignored sources and duplicate addressed incidents based on summary are completely excluded.'

ANALYSIS_TASK_PROMPT = '''Analyze each incident found by the Researcher against the following configuration: {assetConfig}. Determine "doesAffectOrg" (True/False) based on firmware and exposed services. YOU MUST INCLUDE ALL VALIDATED SOURCE URLs and the exact INCIDENT DATE (publication date) in your analysis output for each incident.'''

ANALYSIS_EXPECTED_OUTPUT = 'An impact analysis report strictly containing ONLY incidents that genuinely affect the configuration with solid evidence. Provide technical justification, business risk, the exact incident date, and the corresponding validated source URLs.'

REPORT_TASK_PROMPT = '''Generate a final report in STRICT JSON format. 
The output MUST exactly follow this schema:
{
    "summary": { "scanDate": "...", "timeWindow": "...", "totalIncidents": ..., "criticalCount": ..., "highCount": ..., "mediumCount": ..., "lowCount": ... },
    "incidents": [ { "asset": "...", "incident": "...", "incidentDate": "...", "source": "...", "sourceLinks": ["<URL1>", "<URL2>"], "severity": "...", "cve": [...], "doesAffectOrg": true, "impactAnalysis": "...", "recommendedActions": [...] } ],
    "executiveSummary": { "overallRiskLevel": "...", "keyFindings": [...], "businessImpact": "...", "immediateActions": [...] },
    "references": { ... }
}

Provide only the JSON. '''

REPORT_EXPECTED_OUTPUT = 'A valid JSON object following the specified schema containing ONLY incidents that strictly affect the organization and fall within the time window.'
