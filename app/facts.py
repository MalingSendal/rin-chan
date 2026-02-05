# facts.py

import json
import re
import os

FACTS_FILE = "user_facts.json"

class FactMemory:
    @staticmethod
    def load_facts():
        if os.path.exists(FACTS_FILE):
            with open(FACTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    @staticmethod
    def get_user_facts(user_id):
        facts = FactMemory.load_facts()
        return facts.get(user_id, {})

    @staticmethod
    def save_user_fact(user_id, key, value):
        facts = FactMemory.load_facts()
        if user_id not in facts:
            facts[user_id] = {}
        facts[user_id][key] = value
        with open(FACTS_FILE, "w", encoding="utf-8") as f:
            json.dump(facts, f, indent=2)

    @staticmethod
    def extract_facts_from_message(message):
        patterns = [
            (r"\bmy name is ([\w\s]+)", "user_name"),
            (r"\bmy name's ([\w\s]+)", "user_name"),  
            (r"\bcall me ([\w\s]+)", "user_name"), 
            (r"\bi am ([\w\s]+)", "user_identity"),
            (r"\bi'm ([\w\s]+)", "user_identity"),  
            (r"\bfavorite color is (\w+)", "favorite_color"),
            (r"\bmy fave color is (\w+)", "favorite_color"),  
            (r"\bi like ([\w\s]+)", "likes"),
            (r"\bi'm into ([\w\s]+)", "likes"),  
            (r"\bi'm all about ([\w\s]+)", "likes"),  
            (r"\bi love ([\w\s]+)", "loves"),
            (r"\bi'm a big fan of ([\w\s]+)", "loves"), 
            (r"\bi hate ([\w\s]+)", "hates"),
            (r"\bi can't stand ([\w\s]+)", "hates"),  
            (r"\bi enjoy ([\w\s]+)", "enjoys"),
            (r"\bi prefer ([\w\s]+)", "preference"),
            (r"\bi live in ([\w\s]+)", "location"),
            (r"\bi usually hang out in ([\w\s]+)", "location"),
            (r"\bi was born in ([\w\s]+)", "birthplace"),
            (r"\bi work as a[n]? ([\w\s]+)", "occupation"),
            (r"\bi'm working as ([\w\s]+)", "occupation"), 
            (r"\bi (have|own) a[n]? ([\w\s]+)", "ownership"),
            (r"\bmy birthday is (.+)", "birthday"),
            (r"\bi speak ([\w\s]+)", "languages"),
            (r"\bi use ([\w\s]+)", "tools_or_platforms"),
            (r"\bmy favorite food is ([\w\s]+)", "favorite_food"),
            (r"\bmy go-to food is ([\w\s]+)", "favorite_food"), 
            (r"\bmy favorite movie is ([\w\s]+)", "favorite_movie"),
            (r"\bmy go-to movie is ([\w\s]+)", "favorite_movie"), 
            (r"\bmy favorite book is ([\w\s]+)", "favorite_book"),
            (r"\bmy go-to book is ([\w\s]+)", "favorite_book"),  
            (r"\bmy favorite song is ([\w\s]+)", "favorite_song"),
            (r"\bmy go-to song is ([\w\s]+)", "favorite_song"), 
            (r"\bi am from ([\w\s]+)", "hometown"),
            (r"\bi'm from ([\w\s]+)", "hometown"),  
            (r"\bi study ([\w\s]+)", "field_of_study"),
            (r"\bi'm studying ([\w\s]+)", "field_of_study"),
            (r"\bi'm learning ([\w\s]+)", "field_of_study"), 
            (r"\bi'm a ([\w\s]+)", "user_identity"),
            (r"\bi'm obsessed with ([\w\s]+)", "loves"),  
            (r"\bi dig ([\w\s]+)", "likes"), 
        ]

        found_facts = {}
        for pattern, key in patterns:
            match = re.search(pattern, message.lower())
            if match:
                found_facts[key] = match.group(1).strip()
        return found_facts