"""Request models for AI service endpoints."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class DemandForecastRequest(BaseModel):
    """Request model for demand forecasting."""
    product_ids: List[str] = Field(..., description="List of product IDs to forecast")
    warehouse_ids: Optional[List[str]] = Field(None, description="Optional warehouse IDs to filter by")
    forecast_days: int = Field(30, ge=1, le=365, description="Number of days to forecast")
    include_seasonality: bool = Field(True, description="Whether to include seasonal patterns")


class DeliveryPredictionRequest(BaseModel):
    """Request model for delivery prediction."""
    origin_warehouse: str = Field(..., description="Origin warehouse ID")
    destination_address: Dict[str, str] = Field(..., description="Destination address details")
    product_ids: List[str] = Field(..., description="List of product IDs in shipment")
    carrier: Optional[str] = Field(None, description="Preferred carrier")
    service_level: Optional[str] = Field("standard", description="Service level (standard, express, overnight)")


class AnomalyDetectionRequest(BaseModel):
    """Request model for anomaly detection."""
    data_type: str = Field(..., description="Type of data to analyze (inventory, pricing, orders)")
    time_range: Dict[str, datetime] = Field(..., description="Time range with start and end dates")
    sensitivity: float = Field(0.5, ge=0.0, le=1.0, description="Detection sensitivity (0.0-1.0)")
    include_recommendations: bool = Field(True, description="Whether to include recommendations")