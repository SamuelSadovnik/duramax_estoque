@echo off
cd /d "%~dp0"
echo Instalando dependencias...
call npm install
if errorlevel 1 goto erro
echo Gerando o sistema...
call npm run build
if errorlevel 1 goto erro
echo.
echo Pronto! Agora use o iniciar.bat
pause
exit /b
:erro
echo.
echo Deu erro. Confira se o Node.js 22+ esta instalado: node -v
pause
