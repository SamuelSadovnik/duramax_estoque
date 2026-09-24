@echo off
cd /d "%~dp0"
title Duramax - Estoque SAC
start "" http://localhost:3000
call npm start
pause
