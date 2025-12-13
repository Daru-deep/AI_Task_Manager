from openai import OpenAI
import os

api_key = os.environ.get("OPENAI_API_KEY")
print("API_KEY present:",bool(api_key))

client = OpenAI(api_key=api_key)

resp = client.responses.create(
    model="gpt-4o-mini",
    input=[
        {"role":"system","content":"You are a test bot."},
        {"role":"user","content":"Say 'pong' only"},
    ],
)

print("Response:", resp.output_text)