@echo off
cd /d %~dp0
set PYTHONIOENCODING=utf-8
.venv\Scripts\python.exe web_server.py
pause