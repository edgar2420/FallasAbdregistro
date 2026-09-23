@echo off
setlocal
title Control de Fallas - Docker
cd /d "%~dp0"

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Se creo el archivo .env a partir de .env.example.
  echo Abre .env, define DOMINIO y ADMIN_PASSWORD y vuelve a ejecutar este archivo.
  notepad ".env"
  pause
  exit /b 1
)

echo Construyendo y levantando Control de Fallas en Docker...
docker compose up -d --build
docker compose ps
echo.
echo Listo. Registros: docker compose logs -f app
pause
