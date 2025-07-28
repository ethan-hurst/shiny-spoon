"""Delivery Prediction Agent using Pydantic AI."""

import os
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

from services.supabase_client import get_supabase_client
from models.responses import DeliveryPredictionResponse


class DeliveryContext(BaseModel):
    """Context for delivery prediction operations."""
    historical_deliveries: List[Dict[str, Any]]
    carrier_performance: Dict[str, Any]
    weather_conditions: Dict[str, Any]
    distance_data: Dict[str, Any]


class DeliveryPredictionAgent:
    """Pydantic AI agent for delivery time prediction."""
    
    def __init__(self):
        """Initialize the delivery prediction agent."""
        self.agent = Agent(
            'openai:gpt-4o-mini',
            output_type=DeliveryPredictionResponse,
            system_prompt=(
                "You are an expert logistics and delivery prediction AI. "
                "Analyze historical delivery data, carrier performance, and external factors "
                "to predict accurate delivery times. Consider:\n"
                "- Historical delivery performance by carrier and route\n"
                "- Distance and geography\n"
                "- Weather conditions and seasonal impacts\n"
                "- Carrier-specific performance metrics\n"
                "- Product weight and packaging requirements\n"
                "- Service level commitments\n\n"
                "Provide realistic delivery estimates with confidence scores. "
                "Be conservative with estimates to ensure customer satisfaction."
            )
        )
        self.supabase = get_supabase_client()
    
    async def predict_delivery(
        self,
        origin_warehouse: str,
        destination_address: Dict[str, str],
        product_ids: List[str],
        carrier: Optional[str] = None,
        service_level: str = "standard"
    ) -> DeliveryPredictionResponse:
        """Predict delivery time for a shipment."""
        
        # Fetch historical delivery data
        historical_data = await self._fetch_historical_deliveries(
            origin_warehouse, destination_address, carrier
        )
        
        # Get carrier performance data
        carrier_performance = await self._get_carrier_performance(carrier)
        
        # Get weather and external factors
        weather_conditions = await self._get_weather_conditions(
            origin_warehouse, destination_address
        )
        
        # Calculate distance and route data
        distance_data = await self._calculate_distance_data(
            origin_warehouse, destination_address
        )
        
        # Create context
        context = DeliveryContext(
            historical_deliveries=historical_data,
            carrier_performance=carrier_performance,
            weather_conditions=weather_conditions,
            distance_data=distance_data
        )
        
        # Generate prediction using AI agent
        prompt = self._build_prediction_prompt(
            origin_warehouse,
            destination_address,
            product_ids,
            carrier,
            service_level,
            context
        )
        
        result = await self.agent.run(prompt, message_history=[])
        
        # Enhance result with calculated metrics
        return self._enhance_prediction_result(result.output, context)
    
    async def _fetch_historical_deliveries(
        self,
        origin_warehouse: str,
        destination_address: Dict[str, str],
        carrier: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetch historical delivery data for similar routes."""
        try:
            # Get destination state/region for matching
            dest_state = destination_address.get('state', '')
            dest_zip = destination_address.get('zip', '')
            
            # Query historical deliveries
            query = self.supabase.table('orders').select(
                '*, order_items(*), shipments(*)'
            ).eq('warehouse_id', origin_warehouse)
            
            if carrier:
                query = query.eq('shipments.carrier', carrier)
            
            # Get recent deliveries (last 6 months)
            start_date = datetime.now() - timedelta(days=180)
            query = query.gte('created_at', start_date.isoformat())
            
            response = query.execute()
            return response.data if response.data else []
            
        except Exception as e:
            print(f"Error fetching historical deliveries: {e}")
            return []
    
    async def _get_carrier_performance(
        self,
        carrier: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get carrier performance metrics."""
        # In a real implementation, this would fetch from carrier APIs
        # or internal tracking data
        carriers_data = {
            'fedex': {
                'on_time_rate': 0.92,
                'average_transit_days': 3.2,
                'service_levels': {
                    'standard': 4,
                    'express': 2,
                    'overnight': 1
                }
            },
            'ups': {
                'on_time_rate': 0.89,
                'average_transit_days': 3.5,
                'service_levels': {
                    'standard': 4,
                    'express': 2,
                    'overnight': 1
                }
            },
            'usps': {
                'on_time_rate': 0.85,
                'average_transit_days': 4.1,
                'service_levels': {
                    'standard': 5,
                    'express': 3,
                    'overnight': 2
                }
            }
        }
        
        if carrier and carrier.lower() in carriers_data:
            return carriers_data[carrier.lower()]
        
        # Return average performance if no specific carrier
        return {
            'on_time_rate': 0.89,
            'average_transit_days': 3.6,
            'service_levels': {
                'standard': 4,
                'express': 2,
                'overnight': 1
            }
        }
    
    async def _get_weather_conditions(
        self,
        origin_warehouse: str,
        destination_address: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get weather conditions that might affect delivery."""
        # In a real implementation, this would call weather APIs
        return {
            'origin_weather': 'clear',
            'destination_weather': 'clear',
            'route_conditions': 'normal',
            'seasonal_factor': 1.0,
            'weather_delays_expected': False
        }
    
    async def _calculate_distance_data(
        self,
        origin_warehouse: str,
        destination_address: Dict[str, str]
    ) -> Dict[str, Any]:
        """Calculate distance and route information."""
        # In a real implementation, this would use mapping APIs
        # For now, return estimated data based on zip codes
        try:
            # Fetch warehouse location
            warehouse_query = self.supabase.table('warehouses').select(
                'address, city, state, zip'
            ).eq('id', origin_warehouse)
            
            warehouse_response = warehouse_query.execute()
            warehouse_data = warehouse_response.data[0] if warehouse_response.data else {}
            
            # Estimate distance (simplified calculation)
            estimated_miles = self._estimate_distance(
                warehouse_data.get('zip', ''),
                destination_address.get('zip', '')
            )
            
            return {
                'estimated_miles': estimated_miles,
                'estimated_driving_hours': estimated_miles / 50,  # Assume 50 mph average
                'route_complexity': 'medium',
                'major_cities_on_route': [],
                'border_crossings': 0
            }
            
        except Exception as e:
            print(f"Error calculating distance data: {e}")
            return {
                'estimated_miles': 500,  # Default estimate
                'estimated_driving_hours': 10,
                'route_complexity': 'medium',
                'major_cities_on_route': [],
                'border_crossings': 0
            }
    
    def _estimate_distance(self, origin_zip: str, dest_zip: str) -> float:
        """Simple distance estimation based on zip codes."""
        # This is a very simplified calculation
        # In practice, you'd use proper geocoding and routing APIs
        try:
            origin_num = int(origin_zip[:3]) if origin_zip else 0
            dest_num = int(dest_zip[:3]) if dest_zip else 0
            zip_diff = abs(origin_num - dest_num)
            
            # Very rough estimate: each zip prefix unit ≈ 50 miles
            return min(zip_diff * 50, 3000)  # Cap at 3000 miles
            
        except (ValueError, TypeError):
            return 500  # Default distance
    
    def _build_prediction_prompt(
        self,
        origin_warehouse: str,
        destination_address: Dict[str, str],
        product_ids: List[str],
        carrier: Optional[str],
        service_level: str,
        context: DeliveryContext
    ) -> str:
        """Build the prompt for the AI agent."""
        prompt = f"""
        Predict delivery time for a shipment with the following details:
        
        Origin Warehouse: {origin_warehouse}
        Destination: {destination_address.get('city', '')}, {destination_address.get('state', '')} {destination_address.get('zip', '')}
        Products: {', '.join(product_ids)}
        Carrier: {carrier or 'Not specified'}
        Service Level: {service_level}
        
        Historical Performance Data:
        - Historical deliveries analyzed: {len(context.historical_deliveries)}
        
        Carrier Performance:
        {context.carrier_performance}
        
        Route Information:
        {context.distance_data}
        
        Weather Conditions:
        {context.weather_conditions}
        
        Please provide:
        1. Estimated delivery date and time
        2. Confidence score for the prediction
        3. Transit days calculation
        4. Recommended carrier if none specified
        5. Key factors considered in the prediction
        6. Alternative delivery options if applicable
        
        Be conservative with estimates to ensure customer satisfaction.
        Consider potential delays and provide realistic timelines.
        """
        
        return prompt
    
    def _enhance_prediction_result(
        self,
        result: DeliveryPredictionResponse,
        context: DeliveryContext
    ) -> DeliveryPredictionResponse:
        """Enhance the AI result with additional calculated data."""
        
        # Ensure we have a basic result structure
        if not hasattr(result, 'estimated_delivery_date') or not result.estimated_delivery_date:
            # Fallback calculation
            base_days = context.carrier_performance.get('service_levels', {}).get('standard', 4)
            result.estimated_delivery_date = datetime.now() + timedelta(days=base_days)
        
        if not hasattr(result, 'confidence_score') or result.confidence_score == 0:
            result.confidence_score = 0.8
        
        if not hasattr(result, 'transit_days') or result.transit_days == 0:
            result.transit_days = (result.estimated_delivery_date - datetime.now()).days
        
        if not hasattr(result, 'carrier_recommendation') or not result.carrier_recommendation:
            result.carrier_recommendation = 'FedEx'
        
        if not hasattr(result, 'factors_considered') or not result.factors_considered:
            result.factors_considered = [
                'Historical performance data',
                'Distance and route complexity',
                'Carrier performance metrics',
                'Weather conditions',
                'Service level requirements'
            ]
        
        return result