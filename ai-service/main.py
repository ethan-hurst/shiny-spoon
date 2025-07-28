"""
TruthSource AI Service
Main FastAPI application with Pydantic AI agents for demand forecasting, 
delivery predictions, and anomaly detection.
"""

import os
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from agents.demand_forecasting import DemandForecastingAgent
from agents.delivery_prediction import DeliveryPredictionAgent
from agents.anomaly_detection import AnomalyDetectionAgent
from services.supabase_client import get_supabase_client
from models.requests import (
    DemandForecastRequest,
    DeliveryPredictionRequest,
    AnomalyDetectionRequest
)
from models.responses import (
    DemandForecastResponse,
    DeliveryPredictionResponse,
    AnomalyDetectionResponse,
    HealthResponse
)

# Load environment variables
load_dotenv()

# Global agent instances
demand_agent = None
delivery_agent = None
anomaly_agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize AI agents on startup."""
    global demand_agent, delivery_agent, anomaly_agent
    
    print("Initializing AI agents...")
    
    # Initialize agents
    demand_agent = DemandForecastingAgent()
    delivery_agent = DeliveryPredictionAgent()
    anomaly_agent = AnomalyDetectionAgent()
    
    print("AI agents initialized successfully!")
    yield
    
    # Cleanup on shutdown
    print("Shutting down AI service...")


# Create FastAPI app
app = FastAPI(
    title="TruthSource AI Service",
    description="AI-powered forecasting, prediction, and anomaly detection for B2B e-commerce",
    version="1.0.0",
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
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="truthsource-ai",
        version="1.0.0",
        agents={
            "demand_forecasting": demand_agent is not None,
            "delivery_prediction": delivery_agent is not None,
            "anomaly_detection": anomaly_agent is not None
        }
    )


# Demand forecasting endpoints
@app.post("/api/v1/forecast/demand", response_model=DemandForecastResponse)
async def forecast_demand(request: DemandForecastRequest):
    """Generate demand forecast for products."""
    if not demand_agent:
        raise HTTPException(status_code=503, detail="Demand forecasting agent not initialized")
    
    try:
        result = await demand_agent.forecast_demand(
            product_ids=request.product_ids,
            warehouse_ids=request.warehouse_ids,
            forecast_days=request.forecast_days,
            include_seasonality=request.include_seasonality
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


# Delivery prediction endpoints
@app.post("/api/v1/predict/delivery", response_model=DeliveryPredictionResponse)
async def predict_delivery(request: DeliveryPredictionRequest):
    """Predict delivery time for orders."""
    if not delivery_agent:
        raise HTTPException(status_code=503, detail="Delivery prediction agent not initialized")
    
    try:
        result = await delivery_agent.predict_delivery(
            origin_warehouse=request.origin_warehouse,
            destination_address=request.destination_address,
            product_ids=request.product_ids,
            carrier=request.carrier,
            service_level=request.service_level
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# Anomaly detection endpoints
@app.post("/api/v1/detect/anomalies", response_model=AnomalyDetectionResponse)
async def detect_anomalies(request: AnomalyDetectionRequest):
    """Detect anomalies in data patterns."""
    if not anomaly_agent:
        raise HTTPException(status_code=503, detail="Anomaly detection agent not initialized")
    
    try:
        result = await anomaly_agent.detect_anomalies(
            data_type=request.data_type,
            time_range=request.time_range,
            sensitivity=request.sensitivity,
            include_recommendations=request.include_recommendations
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true"
    )