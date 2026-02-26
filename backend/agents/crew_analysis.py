from crewai import Agent, Task, Crew, Process, LLM
from dotenv import load_dotenv
import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Import DB layer
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dataaccesslayer import get_agents_config as db_get_agents_config, get_ignored_sources

# Load environment variables from .env file
load_dotenv()

from crewai_tools import SerperDevTool, ScrapeWebsiteTool

# Configure Azure OpenAI LLM
def get_llm():
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
    version = os.environ.get("AZURE_OPENAI_API_VERSION")

    if not all([api_key, endpoint, deployment, version]):
        print("[CrewAI] Error: Missing Azure OpenAI configuration in .env file.")
    
    return LLM(
        model=deployment,
        api_key=api_key,
        base_url=endpoint,
        api_version=version,
        temperature=0.2
    )

# Real-World Search and Scraping Tools
search_tool = SerperDevTool()
scrape_tool = ScrapeWebsiteTool()

# Tool Mapping
AVAILABLE_TOOLS = {
    "SerperDevTool": search_tool,
    "ScrapeWebsiteTool": scrape_tool
}

llm = get_llm()

# Orchestration
def run_crew(asset: str, asset_config: Dict[str, Any], scan_date: str, time_duration: str, session_id: str = "default", step_callback=None) -> str:
    # Load Agent Configurations at runtime from DB
    try:
        agents_config = db_get_agents_config(session_id)
        if not agents_config:
            print(f"[CrewAI] Warning: No agents_config found for session {session_id} in DB.")
            agents_config = {}
    except Exception as e:
        print(f"[CrewAI] Error loading agents_config for session {session_id} from DB: {e}")
        agents_config = {}
        
    try:
        ignored_sources_raw = get_ignored_sources()
        if ignored_sources_raw:
            formatted_sources = []
            for item in ignored_sources_raw:
                url = item.get("url", "")
                summary = item.get("summary", "")
                if summary:
                    formatted_sources.append(f"- URL: {url}\\n  Summary: {summary}")
                else:
                    formatted_sources.append(f"- URL: {url}")
            ignored_sources_text = "\\n".join(formatted_sources)
        else:
            ignored_sources_text = "None"
    except Exception as e:
        print(f"[CrewAI] Error loading ignored_sources from DB: {e}")
        ignored_sources_text = "None"

    def create_agent(agent_name: str, display_name: str) -> Agent:
        config = agents_config.get(agent_name, {})
        if not config:
            raise ValueError(f"Configuration for agent '{agent_name}' not found.")
        
        # Map tools
        agent_tools = [AVAILABLE_TOOLS[t] for t in config.get("tools", []) if t in AVAILABLE_TOOLS]
        
        # Map LLM
        agent_llm = llm if config.get("llm") == "azure_openai" else None
        
        def agent_step_callback(step):
            if step_callback:
                # Passes the step and the agent display name
                step_callback(step, agent_name=display_name)
                
        return Agent(
            role=config.get("role", "Unknown Role"),
            goal=config.get("goal", "Unknown Goal"),
            backstory=config.get("backstory", "Unknown Backstory"),
            tools=agent_tools,
            llm=agent_llm,
            verbose=config.get("verbose", True),
            allow_delegation=config.get("allow_delegation", False),
            step_callback=agent_step_callback if step_callback else None
        )

    # Initialize Agents
    researcher = create_agent("researcher", "Threat Researcher Agent")
    analyst = create_agent("analyst", "Threat Analyst Agent")
    summarizer = create_agent("summarizer", "Report Synthesis Agent")

    # Format ignored sources instruction dynamically
    ignored_sources_instruction = ""
    if ignored_sources_text != "None":
        ignored_sources_instruction = f"""
        6. IGNORED INCIDENTS AND SOURCES: The following URLs and incident summaries have already been addressed. You MUST strictly ignore them. DO NOT process the URLs. Furthermore, if you find a new URL that describes an incident matching one of the summaries below, DO NOT report it. They are duplicates of addressed issues.
        \\n{ignored_sources_text}"""

    # Define Tasks
    discovery_task = Task(
        description=f'''Find and research relevant security incidents for {{asset}} in the {{timeDuration}}. 
        
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
        {ignored_sources_instruction}''',
        expected_output='A deep technical report resulting from multiple exhaustive searches, including validated source URLs, scraped data, and affected versions. Ensure ignored sources and duplicate addressed incidents based on summary are completely excluded.',
        agent=researcher
    )

    analysis_task = Task(
        description='''Analyze each incident found by the Researcher against the following configuration: {assetConfig}. Determine "doesAffectOrg" (True/False) based on firmware and exposed services. YOU MUST INCLUDE ALL VALIDATED SOURCE URLs and the exact INCIDENT DATE (publication date) in your analysis output for each incident.''',
        expected_output='An impact analysis report strictly containing ONLY incidents that genuinely affect the configuration with solid evidence. Provide technical justification, business risk, the exact incident date, and the corresponding validated source URLs.',
        agent=analyst,
        context=[discovery_task]
    )

    report_task = Task(
        description='''Generate a final report in STRICT JSON format. 
        The output MUST exactly follow this schema:
        {
            "summary": { "scanDate": "...", "timeWindow": "...", "totalIncidents": ..., "criticalCount": ..., "highCount": ..., "mediumCount": ..., "lowCount": ... },
            "incidents": [ { "asset": "...", "incident": "...", "incidentDate": "...", "source": "...", "sourceLinks": ["<URL1>", "<URL2>"], "severity": "...", "cve": [...], "doesAffectOrg": true, "impactAnalysis": "...", "recommendedActions": [...] } ],
            "executiveSummary": { "overallRiskLevel": "...", "keyFindings": [...], "businessImpact": "...", "immediateActions": [...] },
            "references": { ... }
        }
        
        Provide only the JSON. ''',
        expected_output='A valid JSON object following the specified schema containing ONLY incidents that strictly affect the organization and fall within the time window.',
        agent=summarizer,
        context=[analysis_task]
    )

    # Initialize the Crew
    threat_crew = Crew(
        agents=[researcher, analyst, summarizer],
        tasks=[discovery_task, analysis_task, report_task],
        process=Process.sequential,
        verbose=True
    )

    # Execute
    result = threat_crew.kickoff(inputs={
        "asset": asset,
        "assetConfig": json.dumps(asset_config),
        "currentDate": scan_date,
        "timeDuration": time_duration
    })
    
    return result
