from crewai import Agent, Task, Crew, Process, LLM
from dotenv import load_dotenv
import json
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Import DB layer
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import get_agents_config as db_get_agents_config

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

    # Define Tasks
    discovery_task = Task(
        description='''Find and research relevant security incidents for {asset} in the {timeDuration}. 
        CRITICAL INSTRUCTIONS:
        1. Query Expansion: You MUST run multiple, distinct searches to thoroughly cover the {timeDuration}. Do not rely on a single search query returning everything. Use variations (e.g., "[asset] CVE [year]", "[asset] vulnerability advisory", "[asset] exploit").
        2. Depth over Breadth: Use the ScrapeWebsiteTool to read the actual body of vendor advisories, NVD pages, and technical blogs.
        3. URL Validation: If you find a link, you MUST verify it is a valid, functioning HTTP/HTTPS URL that actually contains the threat intelligence. Do not hallucinate dummy URLs.
        4. Detail Extraction: You MUST extract:
           - The exact Date of discovery or publication (YYYY-MM-DD format)
           - CVE IDs
           - Affected specific firmware or software versions (e.g., SonicOS 7.0)
           - The specific exploit condition or technical root cause
           - Direct remediation steps (e.g., specific CLI commands or patch links)
        5. You MUST explicitly list the validated source URLs for EVERY incident.''',
        expected_output='A deep technical report resulting from multiple exhaustive searches, including validated source URLs, scraped data, and affected versions.',
        agent=researcher
    )

    analysis_task = Task(
        description='Analyze each incident found by the Researcher against the following configuration: {assetConfig}. Determine "doesAffectOrg" (True/False) based on firmware and exposed services. YOU MUST INCLUDE ALL VALIDATED SOURCE URLs and the exact INCIDENT DATE (publication date) in your analysis output for each incident.',
        expected_output='An impact analysis report for each incident, including technical justification, business risk, the exact incident date, and the corresponding validated source URLs.',
        agent=analyst,
        context=[discovery_task]
    )

    report_task = Task(
        description='''Generate a final report in STRICT JSON format. 
        The output MUST exactly follow this schema:
        {
            "summary": { "scanDate": "...", "timeWindow": "...", "totalIncidents": ..., "criticalCount": ..., "highCount": ..., "mediumCount": ..., "lowCount": ... },
            "incidents": [ { "asset": "...", "incident": "...", "incidentDate": "...", "source": "...", "sourceLinks": ["<URL1>", "<URL2>"], "severity": "...", "cve": [...], "doesAffectOrg": ..., "impactAnalysis": "...", "recommendedActions": [...] } ],
            "executiveSummary": { "overallRiskLevel": "...", "keyFindings": [...], "businessImpact": "...", "immediateActions": [...] },
            "references": { ... }
        }
        Provide only the JSON. Do not return empty arrays for sourceLinks if there are URLs provided in the analysis. The "incidentDate" MUST be the exact historical publication date provided by the Researcher/Analyst, NEVER the current date unless it was discovered today.''',
        expected_output='A valid JSON object following the specified schema with populated sourceLinks arrays for every incident.',
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
