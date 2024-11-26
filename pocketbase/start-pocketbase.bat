@echo off
cd %~dp0
pocketbase.exe serve --http="0.0.0.0:8090"
