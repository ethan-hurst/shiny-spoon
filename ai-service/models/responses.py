"""Response models for AI service endpoints."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class DemandForecastItem(BaseModel):
    """Individual demand forecast item."""
    product_id: str
    warehouse_id: Optional[str]
    date: datetime
    predicted_demand: float
    confidence_score: float
    seasonal_factor: Optional[float] = None


class DemandForecastResponse(BaseModel):
    """Response model for demand forecasting."""
    forecasts: List[DemandForecastItem]
    model_accuracy: float
    generated_at: datetime
    forecast_horizon_days: int


class DeliveryPredictionResponse(BaseModel):
    """Response model for delivery prediction."""
    estimated_delivery_date: datetime
    confidence_score: float
    transit_days: int
    carrier_recommendation: str
    factors_considered: List[str]
    alternative_options: Optional[List[Dict[str, Any]]] = None


class AnomalyItem(BaseModel):
    """Individual anomaly detection result."""
    anomaly_type: str
    severity: str  # low, medium, high, critical
    description: str
    affected_entities: List[str]
    detected_at: datetime
    recommendation: Optional[str] = None


class AnomalyDetectionResponse(BaseModel):
    """Response model for anomaly detection."""
    anomalies: List[AnomalyItem]
    total_anomalies: int
    analysis_period: Dict[str, datetime]
    model_confidence: float
    next_check_recommended: datetime


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    service: str
    version: str
    agents: Dict[str, bool]