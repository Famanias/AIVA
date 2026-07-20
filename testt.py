import os

import requests

API_KEY = os.getenv("GROQ_API_KEY")

response = requests.get(
    "https://api.groq.com/openai/v1/models",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)

response.raise_for_status()

models = response.json()["data"]

print(f"Found {len(models)} models:\n")

for model in sorted(models, key=lambda m: m["id"]):
    print(
        f"{model['id']:<40} "
        f"Owner: {model['owned_by']:<15} "
        f"Context: {model.get('context_window', 'N/A')}"
    )