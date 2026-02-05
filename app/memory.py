#memory.py

import os
import csv
import json
from datetime import datetime
import numpy as np
from pytz import timezone
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

MEMORY_FILE = "interaction_memory.json"
MEMORY_CSV = "chat_memory.csv"
MEMORY_JSON = "memory_embeddings.json"
MEMORY_THRESHOLD = 0.5

memory_model = SentenceTransformer('all-MiniLM-L6-v2')

class LongTermMemory:
    @staticmethod
    def get_last_interaction_time(user_id):
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                memory = json.load(f)
                return memory.get(user_id, {}).get("last_interaction")
        return None

    @staticmethod
    def update_last_interaction_time(user_id):
        jakarta_tz = timezone("Asia/Jakarta")
        memory = {}
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                memory = json.load(f)

        if user_id not in memory:
            memory[user_id] = {}

        memory[user_id]["last_interaction"] = datetime.now(jakarta_tz).strftime("%Y-%m-%d %H:%M:%S")

        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            json.dump(memory, f, indent=2)

    @staticmethod
    def init_memory():
        if not os.path.exists(MEMORY_CSV):
            with open(MEMORY_CSV, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "user_id", "user_message", "bot_response", "importance"])

    @staticmethod
    def save_memory(user_id, user_msg, bot_resp, importance=1):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(MEMORY_CSV, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([timestamp, user_id, user_msg, bot_resp, importance])
        LongTermMemory.update_embeddings(user_msg, bot_resp)

    @staticmethod
    def update_embeddings(user_msg, bot_resp):
        memory_text = f"User: {user_msg}\nAI: {bot_resp}"
        embedding = memory_model.encode(memory_text).tolist()

        try:
            with open(MEMORY_JSON, 'r') as f:
                memories = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            memories = {"embeddings": [], "texts": []}

        memories["embeddings"].append(embedding)
        memories["texts"].append(memory_text)

        with open(MEMORY_JSON, 'w') as f:
            json.dump(memories, f)

    @staticmethod
    def recall_memories(query, threshold=MEMORY_THRESHOLD, top_k=3):
        try:
            with open(MEMORY_JSON, 'r') as f:
                memories = json.load(f)
            if not memories["embeddings"]:
                return []

            query_embedding = memory_model.encode(query)
            similarities = cosine_similarity([query_embedding], memories["embeddings"])[0]

            recalled = []
            for i in np.argsort(similarities)[-top_k:][::-1]:
                if similarities[i] > threshold:
                    recalled.append(memories["texts"][i])
            return recalled
        except FileNotFoundError:
            return []