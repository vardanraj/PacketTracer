@echo off
echo ============================================================
echo   NetObserver Agent - Windows Task Scheduler Auto-Start Setup
echo ============================================================
echo.
echo Registering NetObserverAgent.exe with Task Scheduler (Highest Privileges)...
echo.

schtasks /Create /TN "NetObserverAgentAutoStart" /TR "D:\net-observer\agent\dist\NetObserverAgent.exe" /SC ONLOGON /RL HIGHEST /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Task "NetObserverAgentAutoStart" registered successfully!
    echo.
    echo Verifying task details:
    schtasks /Query /TN "NetObserverAgentAutoStart" /FO LIST /V
) else (
    echo.
    echo [ERROR] Failed to register task. Please right-click this batch file and select 'Run as administrator'.
)

echo.
pause
