@echo off
setlocal enableextensions

set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" (
  echo Node.exe not found at "%ProgramFiles%\nodejs\node.exe"
  exit /b 1
)

set "HELPER_SCRIPT=%~dp0mcp-helpers\mcp-helpers.js"

echo Running MCP Helpers: "%NODE%" "%HELPER_SCRIPT%"
"%NODE%" "%HELPER_SCRIPT%"