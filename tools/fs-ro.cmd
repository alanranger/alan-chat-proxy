@echo off
setlocal enableextensions

rem ---- locate node ----
set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" (
  echo [fs-ro] Node.exe not found at "%ProgramFiles%\nodejs\node.exe"
  exit /b 1
)

rem ---- locate the filesystem MCP entry point ----
set "MAIN=%APPDATA%\npm\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js"
if not exist "%MAIN%" (
  echo [fs-ro] MCP server-filesystem not found: "%MAIN%"
  echo [fs-ro] Try:  npm i -g @modelcontextprotocol/server-filesystem
  exit /b 1
)

rem ---- your workspace root (use the real G:\ path, or C:\mcp_root junction you created) ----
set "ROOT=G:\Dropbox\alan ranger photography\Website Code\Chat AI Bot"

echo [fs-ro.cmd] Running:
echo   "%NODE%" "%MAIN%" --root "%ROOT%" --mode readonly
"%NODE%" "%MAIN%" --root "%ROOT%" --mode readonly
