@echo off
REM Test script for local Docker build on Windows

echo Testing Docker build locally...

REM Build the Docker image
echo Building Docker image...
docker build -t whatsai-test .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Docker build successful!
    echo.
    echo To run the container locally:
    echo   docker run -p 8080:8080 -e GEMINI_API_KEY=your_api_key whatsai-test
    echo.
    echo Then visit http://localhost:8080
) else (
    echo.
    echo ❌ Docker build failed!
    exit /b 1
) 