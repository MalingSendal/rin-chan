#llm_client.py

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

API_URL = "http://IP_ADDRESS:11434/v1/chat/completions"
API_KEY = os.getenv("DEEPSEEK_API_KEY")

def call_llm(messages, model="deepseek-r1:1.5b", temperature=0.7, max_tokens=200):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    response = requests.post(API_URL, headers=headers, json=data)
    
    try:
        response.raise_for_status()
        response_data = response.json()
    except requests.exceptions.HTTPError as http_err:
        raise RuntimeError(f"HTTP error: {http_err}, Response: {response.text}")
    except json.JSONDecodeError as json_err:
        raise RuntimeError(f"JSON decode error: {json_err}, Raw response: {response.text}")
    
    return response_data.get("choices", [{}])[0].get("message", {}).get("content", "Sorry, I couldn't process that.")
