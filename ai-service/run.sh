#!/bin/bash

# TruthSource AI Service Development Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TruthSource AI Service${NC}"
echo "========================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is required but not installed.${NC}"
    exit 1
fi

# Check if we're in the ai-service directory
if [[ ! -f "main.py" ]]; then
    echo -e "${RED}Please run this script from the ai-service directory.${NC}"
    exit 1
fi

# Function to setup virtual environment
setup_venv() {
    echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
    
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    
    echo -e "${GREEN}Virtual environment setup complete!${NC}"
}

# Function to run the service
run_service() {
    echo -e "${YELLOW}Starting TruthSource AI Service...${NC}"
    
    # Check if .env file exists
    if [[ ! -f ".env" ]]; then
        echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
        cp .env.example .env
        echo -e "${RED}Please update .env with your API keys and settings.${NC}"
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Run the service
    python main.py
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}Running AI service tests...${NC}"
    source venv/bin/activate
    
    # Add test runner here when tests are implemented
    echo -e "${GREEN}Tests would run here (implement with pytest)${NC}"
}

# Function to build Docker image
build_docker() {
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t truthsource-ai-service .
    echo -e "${GREEN}Docker image built successfully!${NC}"
}

# Main script logic
case "${1:-}" in
    "setup")
        setup_venv
        ;;
    "run")
        run_service
        ;;
    "test")
        run_tests
        ;;
    "docker")
        build_docker
        ;;
    "dev")
        setup_venv
        run_service
        ;;
    *)
        echo "Usage: $0 {setup|run|test|docker|dev}"
        echo ""
        echo "Commands:"
        echo "  setup  - Set up Python virtual environment and install dependencies"
        echo "  run    - Run the AI service"
        echo "  test   - Run tests"
        echo "  docker - Build Docker image"
        echo "  dev    - Setup and run in development mode"
        echo ""
        exit 1
        ;;
esac