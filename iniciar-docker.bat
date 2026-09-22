@echo off
setlocal
title Control de Fallas - Docker
cd /d "%~dp0"

echo Levantando PostgreSQL y backend con Docker...
docker compose up --build

pause
