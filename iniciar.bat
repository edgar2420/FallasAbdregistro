@echo off
title Control de Fallas Tecnicas
cd /d "%~dp0"
if not exist "backend\node_modules" call npm --prefix backend install
if not exist "frontend-angular\node_modules" call npm --prefix frontend-angular install
echo Compilando interfaz...
call npm run build
if errorlevel 1 (
  echo No se pudo compilar la interfaz.
  pause
  exit /b 1
)
echo.
echo   Abriendo http://localhost:4010
start "" http://localhost:4010
call npm start
pause
