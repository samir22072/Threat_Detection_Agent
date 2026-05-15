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
from agents.prompts import (
    DISCOVERY_TASK_PROMPT,
    DISCOVERY_EXPECTED_OUTPUT,
    ANALYSIS_TASK_PROMPT,
    ANALYSIS_EXPECTED_OUTPUT,
    REPORT_TASK_PROMPT,
    REPORT_EXPECTED_OUTPUT
)

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

from agents.tools import DateSortedSearchTool, NewsSearchTool

# Global scrape tool (doesn't need dynamic time boundaries)
scrape_tool = ScrapeWebsiteTool()

llm = get_llm()

# Orchestration
def run_crew(asset: str, asset_config: Dict[str, Any], scan_date: str, time_duration: str, session_id: str = "default", step_callback=None) -> str:
    
    # 1. Parse UI Time Duration into Google Search Time Boundary
    time_bound = ""
    td_lower = time_duration.lower()
    if "24 hours" in td_lower or "24 hr" in td_lower or "day" in td_lower:
        time_bound = "d"
    elif "week" in td_lower or "7 days" in td_lower:
        time_bound = "w"
    elif "month" in td_lower or "30 days" in td_lower or "60 days" in td_lower:
        time_bound = "m"
    elif "year" in td_lower:
        time_bound = "y"
        
    print(f"[CrewAI] Parsed mapped time boundary '{time_bound}' for duration string: {time_duration}")
        
    # 2. Instantiate Search Tools locally per-run to strictly enforce time bound
    search_tool = DateSortedSearchTool(time_bound=time_bound)
    news_tool = NewsSearchTool(time_bound=time_bound)
    
    available_tools = {
        "DateSortedSearchTool": search_tool,
        "NewsSearchTool": news_tool,
        "ScrapeWebsiteTool": scrape_tool
    }
    
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
        agent_tools = [available_tools[t] for t in config.get("tools", []) if t in available_tools]
        
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
        description=DISCOVERY_TASK_PROMPT.format(ignored_sources_instruction=ignored_sources_instruction),
        expected_output=DISCOVERY_EXPECTED_OUTPUT,
        agent=researcher
    )

    analysis_task = Task(
        description=ANALYSIS_TASK_PROMPT,
        expected_output=ANALYSIS_EXPECTED_OUTPUT,
        agent=analyst,
        context=[discovery_task]
    )

    report_task = Task(
        description=REPORT_TASK_PROMPT,
        expected_output=REPORT_EXPECTED_OUTPUT,
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
