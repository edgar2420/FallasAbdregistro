@echo off
setlocal
title Control de Fallas - Angular + Express
cd /d "%~dp0"

echo ================================================
echo       CONTROL DE FALLAS - ENTORNO LOCAL
echo ================================================
echo.

if not exist "backend\node_modules" (
  echo Instalando dependencias del backend...
  call npm --prefix backend install
)

if not exist "frontend-angular\node_modules" (
  echo Instalando dependencias de Angular...
  call npm --prefix frontend-angular install
)

echo Preparando usuarios y datos iniciales...
call npm --prefix backend run seed

echo Iniciando API Express en http://localhost:4010 ...
start "Control de Fallas - API" /D "%~dp0backend" cmd /k "npm run dev"

echo Iniciando Angular en http://localhost:4200 ...
start "Control de Fallas - Angular" /D "%~dp0frontend-angular" cmd /k "npm start"

timeout /t 5 /nobreak >nul
start "" "http://localhost:4200"

echo.
echo Sistema iniciado.
echo Web: http://localhost:4200
echo API: http://localhost:4010
echo.
echo Usuarios locales:
echo   Administrador: admin / Admin1234!
echo   Operador:      operador / Operador1234!
echo.
pause
