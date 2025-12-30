@echo off
cd /d C:\programming\dev\AI_Task_Manager

call .venv\Scripts\activate

start "" http://127.0.0.1:5000

python web_server.py

pause
