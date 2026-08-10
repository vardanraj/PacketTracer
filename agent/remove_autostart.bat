@echo off
echo ============================================================
echo   NetObserver Agent - Task Scheduler Auto-Start Removal
echo ============================================================
echo.

schtasks /Delete /TN "NetObserverAgentAutoStart" /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Task "NetObserverAgentAutoStart" removed successfully.
) else (
    echo.
    echo [ERROR] Failed to remove task. Please right-click this batch file and select 'Run as administrator'.
)

echo.
pause
