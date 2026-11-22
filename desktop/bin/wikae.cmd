@echo off
rem The Wikae command that comes with the desktop app: the app's own engine, run by Wikae.exe in Node mode.
setlocal
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\..\..\..\Wikae.exe" "%~dp0..\..\bin\wikae.js" %*
