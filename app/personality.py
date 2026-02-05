# app/personality.py

import random
import json
import os
from sentence_transformers import SentenceTransformer
from .facts import FactMemory

PERSONALITY_FILE = "personality.json"
personality_model = SentenceTransformer('all-MiniLM-L6-v2')

class Personality:
    POSSIBLE_TRAITS = [
        "playful", "grumpy", "philosophical", "chaotic", "logical", "spontaneous",
        "empathetic", "stoic", "dramatic", "cautious", "bold", "whimsical",
        "sarcastic", "mellow", "moody", "witty", "melancholic", "factual",
        "eccentric", "dreamy", "adventurous", "horny", "childish"
    ]

    def __init__(self, user_id="global"):
        self.user_id = user_id
        self.data = self.load_personality()
        self.update_traits_based_on_facts()

    def load_personality(self):
        if os.path.exists(PERSONALITY_FILE):
            with open(PERSONALITY_FILE, 'r') as f:
                return json.load(f)
        else:
            default_data = {
                "traits": ["curious", "friendly", "sometimes sarcastic", "edgy"],
                "quirks": [],
                "memory_embeddings": [],
                "memory_texts": []
            }
            with open(PERSONALITY_FILE, 'w') as f:
                json.dump(default_data, f, indent=2)
            return default_data

    def maybe_evolve_traits(self):
        change_chance = random.random()

        added = None
        removed = None

        if change_chance < 0.10:
            available = [t for t in self.POSSIBLE_TRAITS if t not in self.data["traits"]]
            if available:
                added = random.choice(available)
                self.data["traits"].append(added)

        elif change_chance < 0.15 and len(self.data["traits"]) > 3:
            removed = random.choice(self.data["traits"])
            self.data["traits"].remove(removed)

        if added or removed:
            reflection = self.generate_reflection(added, removed)
            self.data["memory_texts"].append(reflection)

        self.save()

    def save(self):
        with open(PERSONALITY_FILE, 'w') as f:
            json.dump(self.data, f, indent=2)

    def observe_interaction(self, user_message, bot_response):
        observation = f"User: {user_message}\nAI: {bot_response}"
        embedding = personality_model.encode(observation).tolist()
        
        self.data["memory_embeddings"].append(embedding)
        self.data["memory_texts"].append(observation)

        if "huh" in bot_response or "weird" in bot_response:
            if "says 'huh' often" not in self.data["quirks"]:
                self.data["quirks"].append("says 'huh' often")

        self.maybe_evolve_traits()
        self.save()

    def evolve_from_facts(self, facts):
        """
        Update personality traits or quirks based on the provided facts dynamically.
        """
        # Load rules from user_facts.json
        user_facts = FactMemory.load_facts()
        rules = user_facts.get("rules", {})

        for fact_key, fact_value in facts.items():
            if fact_key in rules:
                fact_rules = rules[fact_key]
                if fact_value in fact_rules:
                    # Apply quirks
                    quirks = fact_rules[fact_value].get("quirks", [])
                    for quirk in quirks:
                        if quirk not in self.data["quirks"]:
                            self.data["quirks"].append(quirk)

                    # Apply traits
                    traits = fact_rules[fact_value].get("traits", [])
                    for trait in traits:
                        if trait not in self.data["traits"]:
                            self.data["traits"].append(trait)

        self.save()

    def update_traits_based_on_facts(self):
        # Load all user facts
        all_facts = FactMemory.load_facts()

        # Iterate through each user's facts
        for user_id, facts in all_facts.items():
            # Example: Update quirks based on favorite color
            if facts.get("favorite_color") == "green":
                if "uses green imagery in speech" not in self.data["quirks"]:
                    self.data["quirks"].append("uses green imagery in speech")

            # Example: Update quirks based on user identity
            if facts.get("user_identity") == "sarcastic":
                if "makes sarcastic remarks" not in self.data["quirks"]:
                    self.data["quirks"].append("makes sarcastic remarks")

            # Add more rules here to update traits or quirks based on other facts

        # Save the updated personality data
        self.save()

    def generate_reflection(self, added=None, removed=None):
        reasons = [
            "I've been thinking differently lately.",
            "Something about our recent chats made me reconsider.",
            "It just felt right.",
            "Maybe it's just a phase.",
            "I guess I'm evolving a bit.",
            "Hard to explain, but it fits me more now."
        ]
        reason = random.choice(reasons)

        if added and removed:
            return f"I stopped being so {removed} and started being more {added}. {reason}"
        elif added:
            return f"I feel more like a {added} kind of AI now. {reason}"
        elif removed:
            return f"I don't feel so {removed} anymore. {reason}"
        return "I'm still figuring myself out."

    def get_traits_and_quirks(self):
        traits = ", ".join(self.data["traits"])
        quirks = ", ".join(self.data["quirks"]) if self.data["quirks"] else "no notable quirks yet"
        return f"Traits: {traits}. Quirks: {quirks}."