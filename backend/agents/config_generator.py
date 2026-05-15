import json
import os
from langchain_core.prompts import PromptTemplate
from langchain_openai import AzureChatOpenAI

# Import DB layer
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dataaccesslayer import update_agents_config

from agents.prompts import CONFIG_GENERATOR_PROMPT


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
    prompt = PromptTemplate.from_template(CONFIG_GENERATOR_PROMPT)
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
