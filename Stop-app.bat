@echo off
cd /d "%~dp0"
echo Stopping POS App...
docker-compose down
echo POS App stopped.
pause
