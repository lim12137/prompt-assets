@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "SCRIPT=%~dp0scripts\local-debug.mjs"
set "ACTION=%~1"
set "LAUNCHED_WITHOUT_ARGS=0"
if "%ACTION%"=="" (
  set "ACTION=dev"
  set "LAUNCHED_WITHOUT_ARGS=1"
)

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
call :run_action prepare
exit /b %ERRORLEVEL%

:db_up
call :run_action db-up
exit /b %ERRORLEVEL%

:web
call :run_action web
exit /b %ERRORLEVEL%

:restart_web
call :run_action restart-web
exit /b %ERRORLEVEL%

:stop_web
call :run_action stop-web
exit /b %ERRORLEVEL%

:db_down
call :run_action db-down
exit /b %ERRORLEVEL%

:status
call :run_action db-status
exit /b %ERRORLEVEL%

:logs
call :run_action db-logs
exit /b %ERRORLEVEL%

:dev
call :run_action dev
exit /b %ERRORLEVEL%

:run_action
set "RUN_ACTION=%~1"

if not exist "%SCRIPT%" (
  echo [local-debug] Missing script: "%SCRIPT%"
  call :handle_failure 1
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [local-debug] Node.js was not found in PATH.
  echo [local-debug] Install Node.js or run from a terminal where node is available.
  call :handle_failure 1
  exit /b 1
)

if /I "%RUN_ACTION%"=="dev" call :ensure_pnpm || exit /b 1
if /I "%RUN_ACTION%"=="prepare" call :ensure_pnpm || exit /b 1
if /I "%RUN_ACTION%"=="web" call :ensure_pnpm || exit /b 1
if /I "%RUN_ACTION%"=="restart-web" call :ensure_pnpm || exit /b 1

node "%SCRIPT%" %RUN_ACTION%
set "RUN_EXIT=%ERRORLEVEL%"
if not "%RUN_EXIT%"=="0" (
  echo [local-debug] Action "%RUN_ACTION%" failed with exit code %RUN_EXIT%.
  call :handle_failure %RUN_EXIT%
  exit /b %RUN_EXIT%
)

exit /b 0

:ensure_pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
  echo [local-debug] pnpm was not found in PATH.
  echo [local-debug] Install pnpm or enable corepack first.
  call :handle_failure 1
  exit /b 1
)

exit /b 0

:handle_failure
set "FAIL_CODE=%~1"
if "%FAIL_CODE%"=="" set "FAIL_CODE=1"

if "%LAUNCHED_WITHOUT_ARGS%"=="1" (
  if not "%LOCAL_DEBUG_NO_PAUSE%"=="1" (
    echo.
    echo [local-debug] Startup failed. Press any key to close this window...
    pause >nul
  )
)

exit /b %FAIL_CODE%

:help
echo Usage: local-debug.bat [action]
echo.
echo Actions:
echo   prepare      Start local Docker database, run migrations, seed data.
echo   db-up        Start local Docker database only.
echo   web          Start local web service on 127.0.0.1:3010.
echo   restart-web  Stop local web listener and start it again.
echo   stop-web     Stop process listening on the local web port.
echo   db-down      Stop and remove local Docker database.
echo   status       Show local Docker database status.
echo   logs         Show local Docker database logs.
echo   dev          Prepare database, then start web.
echo.
echo If action is omitted, local-debug.bat defaults to "dev".
exit /b 0

:help_error
echo Usage: local-debug.bat [prepare^|db-up^|web^|restart-web^|stop-web^|db-down^|status^|logs^|dev]
exit /b 1
