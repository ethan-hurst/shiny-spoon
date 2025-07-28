"""
Test main.py that works without external dependencies
"""

import os
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Mock agents for testing
class MockAgent:
    def __init__(self, name):
        self.name = name
    
    async def forecast_demand(self, **kwargs):
        return {
            "forecasts": [],
            "model_accuracy": 0.85,
            "generated_at": "2024-01-01T00:00:00Z",
            "forecast_horizon_days": 30
        }
    
    async def predict_delivery(self, **kwargs):
        return {
            "estimated_delivery_date": "2024-01-05T00:00:00Z",
            "confidence_score": 0.8,
            "transit_days": 3,
            "carrier_recommendation": "FedEx",
            "factors_considered": ["Distance", "Carrier performance"]
        }
    
    async def detect_anomalies(self, **kwargs):
        return {
            "anomalies": [],
            "total_anomalies": 0,
            "analysis_period": kwargs.get("time_range", {}),
            "model_confidence": 0.9,
            "next_check_recommended": "2024-01-01T01:00:00Z"
        }

# Global agent instances
demand_agent = None
delivery_agent = None
anomaly_agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize AI agents on startup."""
    global demand_agent, delivery_agent, anomaly_agent
    
    print("Initializing mock AI agents...")
    
    # Initialize mock agents for testing
    demand_agent = MockAgent("demand_forecasting")
    delivery_agent = MockAgent("delivery_prediction")
    anomaly_agent = MockAgent("anomaly_detection")
    
    print("Mock AI agents initialized successfully!")
    yield
    
    # Cleanup on shutdown
    print("Shutting down AI service...")


# Create FastAPI app
app = FastAPI(
    title="TruthSource AI Service (Test Mode)",
    description="AI-powered forecasting, prediction, and anomaly detection for B2B e-commerce",
    version="1.0.0-test",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "truthsource-ai-test",
        "version": "1.0.0-test",
        "agents": {
            "demand_forecasting": demand_agent is not None,
            "delivery_prediction": delivery_agent is not None,
            "anomaly_detection": anomaly_agent is not None
        }
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "TruthSource AI Service (Test Mode)",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "openapi": "/openapi.json"
        }
    }


if __name__ == "__main__":
    uvicorn.run(
        "test_main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )