@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Samok 2 - ovingsapp

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js er ikke installert.
  echo  Last ned "LTS"-versjonen fra https://nodejs.org og installer den.
  echo  Start deretter PC-en pa nytt og dobbeltklikk start.bat igjen.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo  Installerer det appen trenger. Dette skjer bare forste gang og tar litt tid ...
  call npm install
  if errorlevel 1 (
    echo  Installasjonen feilet. Sjekk internettforbindelsen og prov igjen.
    pause
    exit /b
  )
)

if not exist .env (
  copy .env.example .env >nul
  echo  Laget filen .env. Apne den i Notisblokk og lim inn API-nokkelen din.
)

start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
pause
