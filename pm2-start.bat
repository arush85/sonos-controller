@echo off
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%
pm2 resurrect
