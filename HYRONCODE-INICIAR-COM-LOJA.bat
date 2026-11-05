@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist "packages\cli\src\index.ts" (
  echo Coloque este BAT e o arquivo hyron-plugin-bridge.cjs na pasta raiz do HYRON-CODE.
  pause
  exit /b 2
)
if not exist "hyron-plugin-bridge.cjs" (
  echo Bridge nao encontrado. Rode o instalador da loja primeiro.
  pause
  exit /b 2
)
start "HYRONCODE - Gerenciador Local de Plugins" cmd /k "node hyron-plugin-bridge.cjs"
echo Iniciando HYRONCODE...
bun run dev:desktop
pause
