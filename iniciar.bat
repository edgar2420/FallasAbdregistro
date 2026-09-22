@echo off
title Control de Fallas Tecnicas
cd /d "%~dp0"
if not exist "frontend-angular\dist\frontend-angular\browser\index.html" (
  echo Compilando interfaz...
  call npm run build
)
echo.
echo   Abriendo http://localhost:4010
start "" http://localhost:4010
call npm start
pause
