import json
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import AzureChatOpenAI

# Import DB layer
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import update_agents_config

PROMPT = """You are an expert Cyber Security Architect configuring a multi-agent system.
We have three agents:
1. researcher: Finds recent security incidents and CVEs. Needs tools: ['SerperDevTool', 'ScrapeWebsiteTool']
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
    "tools": ["SerperDevTool", "ScrapeWebsiteTool"],
    "llm": "azure_openai",
    "verbose": true,
    "allow_delegation": false
  }},
  "analyst": {{ ... }},
  "summarizer": {{ ... }}
}}
"""

def get_langchain_llm():
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
    if deployment and deployment.startswith("azure/"):
        deployment = deployment.replace("azure/", "", 1)
    version = os.environ.get("AZURE_OPENAI_API_VERSION")

    return AzureChatOpenAI(
        azure_deployment=deployment,
        api_version=version,
        azure_endpoint=endpoint,
        api_key=api_key,
        temperature=0.2
    )

def generate_agents_config(asset_config_str: str, session_id: str = "default") -> None:
    llm = get_langchain_llm()
    prompt = PromptTemplate.from_template(PROMPT)
    chain = prompt | llm
    
    response = chain.invoke({"asset_config": asset_config_str})
    
    # Parse the response to ensure it's valid JSON
    # Content comes back via content attribute or as a string depending on Langchain version
    content = getattr(response, 'content', str(response)).strip()
    
    if content.startswith("```json"):
        content = content.replace("```json", "").replace("```", "").strip()
    elif content.startswith("```"):
        content = content.replace("```", "").strip()
        
    try:
        config_data = json.loads(content)
        # Update config in DB instead of local file
        update_agents_config(session_id, config_data)
        print(f"[ConfigGenerator] Successfully updated agents_config for session {session_id} in DB")
    except json.JSONDecodeError as e:
        print(f"[ConfigGenerator] Failed to parse JSON from LLM: {e}")
        print(f"Raw response: {content}")
        raise ValueError("LLM did not return valid JSON.")
