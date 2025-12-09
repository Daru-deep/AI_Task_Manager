from openai import OpenAI
import os

api_key = os.environ.get("OPENAI_API_KEY")
print("API_KEY present:",bool(api_key))

client = OpenAI(api_key=api_key)

resp = client.chat.completions.create(
    model = "gpt-4o-mini",
    messages=[
        {"role":"system","content":"You are a test bot."},
        {"role":"user","content":"Say 'pong' only"},
    ],
)

print("Response:",resp.choices[0].message.content)