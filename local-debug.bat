@echo off
setlocal

set "SCRIPT=%~dp0scripts\local-debug.mjs"
set "ACTION=%~1"

if "%ACTION%"=="" goto help
if /I "%ACTION%"=="help" goto help
if /I "%ACTION%"=="prepare" goto prepare
if /I "%ACTION%"=="db-up" goto db_up
if /I "%ACTION%"=="web" goto web
if /I "%ACTION%"=="restart-web" goto restart_web
if /I "%ACTION%"=="stop-web" goto stop_web
if /I "%ACTION%"=="db-down" goto db_down
if /I "%ACTION%"=="status" goto status
if /I "%ACTION%"=="logs" goto logs
if /I "%ACTION%"=="dev" goto dev

echo Unknown action: %ACTION%
echo.
goto help_error

:prepare
node "%SCRIPT%" prepare
exit /b %ERRORLEVEL%

:db_up
node "%SCRIPT%" db-up
exit /b %ERRORLEVEL%

:web
node "%SCRIPT%" web
exit /b %ERRORLEVEL%

:restart_web
node "%SCRIPT%" restart-web
exit /b %ERRORLEVEL%

:stop_web
node "%SCRIPT%" stop-web
exit /b %ERRORLEVEL%

:db_down
node "%SCRIPT%" db-down
exit /b %ERRORLEVEL%

:status
node "%SCRIPT%" db-status
exit /b %ERRORLEVEL%

:logs
node "%SCRIPT%" db-logs
exit /b %ERRORLEVEL%

:dev
node "%SCRIPT%" dev
exit /b %ERRORLEVEL%

:help
echo Usage: local-debug.bat ^<action^>
echo.
echo Actions:
echo   prepare      Start local Docker database, run migrations, seed data.
echo   db-up        Start local Docker database only.
echo   web          Start local web service on 127.0.0.1:13000.
echo   restart-web  Stop local web listener and start it again.
echo   stop-web     Stop process listening on the local web port.
echo   db-down      Stop and remove local Docker database.
echo   status       Show local Docker database status.
echo   logs         Show local Docker database logs.
echo   dev          Prepare database, then start web.
exit /b 0

:help_error
echo Usage: local-debug.bat ^<prepare^|db-up^|web^|restart-web^|stop-web^|db-down^|status^|logs^|dev^>
exit /b 1
