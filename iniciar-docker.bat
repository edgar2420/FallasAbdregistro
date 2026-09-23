@echo off
setlocal
title Control de Fallas - Docker
cd /d "%~dp0"

echo Construyendo y levantando Control de Fallas en Docker (http://localhost:4010)...
docker compose up --build

pause
