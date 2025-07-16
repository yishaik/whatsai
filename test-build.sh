#!/bin/bash

# Test script for local Docker build
echo "Testing Docker build locally..."

# Build the Docker image
echo "Building Docker image..."
docker build -t whatsai-test .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    
    echo ""
    echo "To run the container locally:"
    echo "  docker run -p 8080:8080 -e GEMINI_API_KEY=your_api_key whatsai-test"
    echo ""
    echo "Then visit http://localhost:8080"
else
    echo "❌ Docker build failed!"
    exit 1
fi 