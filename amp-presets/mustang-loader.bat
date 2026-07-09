@echo off
rem Double-click launcher for the Mustang Preset Loader UI.
cd /d "%~dp0"
python load_presets_gui.py
if errorlevel 1 pause
