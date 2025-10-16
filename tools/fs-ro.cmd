@echo off
setlocal enableextensions

rem === Resolve Node and the MCP filesystem server entrypoint ===
set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" (
  echo Node.exe not found at "%ProgramFiles%\nodejs\node.exe"
  exit /b 1
)

set "MAIN=%APPDATA%\npm\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js"
if not exist "%MAIN%" (
  echo MCP server-filesystem entry not found: "%MAIN%"
  echo Try:  npm i -g @modelcontextprotocol/server-filesystem
  exit /b 1
)

rem === Root: argument 1, or default to current dir ===
set "ROOT=%~1"
if "%ROOT%"=="" set "ROOT=%CD%"

rem === Mode: read-only ===
"%NODE%" "%MAIN%" --root "%ROOT%" --mode readonly
