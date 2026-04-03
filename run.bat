@echo off
cd /d %~dp0
set PYTHONIOENCODING=utf-8
start "" http://127.0.0.1:5000
.venv\Scripts\python.exe web_server.py
pause