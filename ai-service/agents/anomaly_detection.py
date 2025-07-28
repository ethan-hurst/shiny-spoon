"""Anomaly Detection Agent using Pydantic AI."""

import os
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel

from services.supabase_client import get_supabase_client
from models.responses import AnomalyDetectionResponse, AnomalyItem


class AnomalyContext(BaseModel):
    """Context for anomaly detection operations."""
    historical_data: List[Dict[str, Any]]
    baseline_metrics: Dict[str, float]
    alert_thresholds: Dict[str, float]
    recent_patterns: Dict[str, Any]


class AnomalyDetectionAgent:
    """Pydantic AI agent for anomaly detection."""
    
    def __init__(self):
        """Initialize the anomaly detection agent."""
        self.agent = Agent(
            'openai:gpt-4o-mini',
            output_type=AnomalyDetectionResponse,
            system_prompt=(
                "You are an expert anomaly detection AI for B2B e-commerce systems. "
                "Analyze data patterns to identify unusual behaviors that might indicate:\n"
                "- Inventory sync issues\n"
                "- Pricing discrepancies\n"
                "- Unusual order patterns\n"
                "- System performance problems\n"
                "- Data quality issues\n"
                "- Potential fraud or errors\n\n"
                "Categorize anomalies by severity (low, medium, high, critical) and "
                "provide actionable recommendations for resolution. "
                "Focus on business-critical issues that could impact revenue or customer satisfaction."
            )
        )
        self.supabase = get_supabase_client()
    
    async def detect_anomalies(
        self,
        data_type: str,
        time_range: Dict[str, datetime],
        sensitivity: float = 0.5,
        include_recommendations: bool = True
    ) -> AnomalyDetectionResponse:
        """Detect anomalies in specified data type and time range."""
        
        # Fetch relevant data
        historical_data = await self._fetch_data_for_analysis(
            data_type, time_range
        )
        
        # Calculate baseline metrics
        baseline_metrics = await self._calculate_baseline_metrics(
            historical_data, data_type
        )
        
        # Set alert thresholds based on sensitivity
        alert_thresholds = self._calculate_alert_thresholds(
            baseline_metrics, sensitivity
        )
        
        # Analyze recent patterns
        recent_patterns = await self._analyze_recent_patterns(
            historical_data, data_type
        )
        
        # Create context
        context = AnomalyContext(
            historical_data=historical_data,
            baseline_metrics=baseline_metrics,
            alert_thresholds=alert_thresholds,
            recent_patterns=recent_patterns
        )
        
        # Generate anomaly detection using AI agent
        prompt = self._build_detection_prompt(
            data_type, time_range, sensitivity, context
        )
        
        result = await self.agent.run(prompt, message_history=[])
        
        # Enhance result with statistical analysis
        return self._enhance_detection_result(result.output, context, time_range)
    
    async def _fetch_data_for_analysis(
        self,
        data_type: str,
        time_range: Dict[str, datetime]
    ) -> List[Dict[str, Any]]:
        """Fetch data for anomaly analysis based on type."""
        try:
            start_date = time_range['start']
            end_date = time_range['end']
            
            if data_type == 'inventory':
                return await self._fetch_inventory_data(start_date, end_date)
            elif data_type == 'pricing':
                return await self._fetch_pricing_data(start_date, end_date)
            elif data_type == 'orders':
                return await self._fetch_order_data(start_date, end_date)
            else:
                print(f"Unknown data type: {data_type}")
                return []
                
        except Exception as e:
            print(f"Error fetching data for analysis: {e}")
            return []
    
    async def _fetch_inventory_data(
        self, start_date: datetime, end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch inventory data for analysis."""
        query = self.supabase.table('inventory_movements').select(
            '*, products(*), warehouses(*)'
        ).gte('created_at', start_date.isoformat()).lte(
            'created_at', end_date.isoformat()
        ).order('created_at')
        
        response = query.execute()
        return response.data if response.data else []
    
    async def _fetch_pricing_data(
        self, start_date: datetime, end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch pricing data for analysis."""
        query = self.supabase.table('pricing_history').select(
            '*, products(*), customers(*)'
        ).gte('created_at', start_date.isoformat()).lte(
            'created_at', end_date.isoformat()
        ).order('created_at')
        
        response = query.execute()
        return response.data if response.data else []
    
    async def _fetch_order_data(
        self, start_date: datetime, end_date: datetime
    ) -> List[Dict[str, Any]]:
        """Fetch order data for analysis."""
        query = self.supabase.table('orders').select(
            '*, order_items(*), customers(*)'
        ).gte('created_at', start_date.isoformat()).lte(
            'created_at', end_date.isoformat()
        ).order('created_at')
        
        response = query.execute()
        return response.data if response.data else []
    
    async def _calculate_baseline_metrics(
        self, historical_data: List[Dict[str, Any]], data_type: str
    ) -> Dict[str, float]:
        """Calculate baseline metrics for comparison."""
        if not historical_data:
            return {}
        
        try:
            df = pd.DataFrame(historical_data)
            
            if data_type == 'inventory':
                return self._calculate_inventory_baseline(df)
            elif data_type == 'pricing':
                return self._calculate_pricing_baseline(df)
            elif data_type == 'orders':
                return self._calculate_order_baseline(df)
            else:
                return {}
                
        except Exception as e:
            print(f"Error calculating baseline metrics: {e}")
            return {}
    
    def _calculate_inventory_baseline(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calculate inventory baseline metrics."""
        if df.empty:
            return {}
        
        metrics = {}
        
        if 'quantity_change' in df.columns:
            metrics['avg_quantity_change'] = df['quantity_change'].mean()
            metrics['std_quantity_change'] = df['quantity_change'].std()
            metrics['max_quantity_change'] = df['quantity_change'].max()
            metrics['min_quantity_change'] = df['quantity_change'].min()
        
        if 'created_at' in df.columns:
            df['date'] = pd.to_datetime(df['created_at'])
            daily_movements = df.groupby(df['date'].dt.date).size()
            metrics['avg_daily_movements'] = daily_movements.mean()
            metrics['std_daily_movements'] = daily_movements.std()
        
        return metrics
    
    def _calculate_pricing_baseline(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calculate pricing baseline metrics."""
        if df.empty:
            return {}
        
        metrics = {}
        
        if 'price' in df.columns:
            metrics['avg_price'] = df['price'].mean()
            metrics['std_price'] = df['price'].std()
            metrics['max_price'] = df['price'].max()
            metrics['min_price'] = df['price'].min()
        
        if 'discount_percentage' in df.columns:
            metrics['avg_discount'] = df['discount_percentage'].mean()
            metrics['std_discount'] = df['discount_percentage'].std()
        
        return metrics
    
    def _calculate_order_baseline(self, df: pd.DataFrame) -> Dict[str, float]:
        """Calculate order baseline metrics."""
        if df.empty:
            return {}
        
        metrics = {}
        
        if 'total_amount' in df.columns:
            metrics['avg_order_value'] = df['total_amount'].mean()
            metrics['std_order_value'] = df['total_amount'].std()
            metrics['max_order_value'] = df['total_amount'].max()
            metrics['min_order_value'] = df['total_amount'].min()
        
        if 'created_at' in df.columns:
            df['date'] = pd.to_datetime(df['created_at'])
            daily_orders = df.groupby(df['date'].dt.date).size()
            metrics['avg_daily_orders'] = daily_orders.mean()
            metrics['std_daily_orders'] = daily_orders.std()
        
        return metrics
    
    def _calculate_alert_thresholds(
        self, baseline_metrics: Dict[str, float], sensitivity: float
    ) -> Dict[str, float]:
        """Calculate alert thresholds based on baseline and sensitivity."""
        thresholds = {}
        
        # Higher sensitivity = lower thresholds (more alerts)
        # Lower sensitivity = higher thresholds (fewer alerts)
        sensitivity_factor = 2.0 - sensitivity  # Range: 1.0 to 2.0
        
        for metric, value in baseline_metrics.items():
            if 'std' in metric:
                # For standard deviation metrics, use as threshold multiplier
                thresholds[f"{metric}_threshold"] = value * sensitivity_factor
            else:
                # For average metrics, create upper and lower bounds
                std_key = metric.replace('avg', 'std')
                if std_key in baseline_metrics:
                    std_value = baseline_metrics[std_key]
                    thresholds[f"{metric}_upper"] = value + (std_value * sensitivity_factor)
                    thresholds[f"{metric}_lower"] = value - (std_value * sensitivity_factor)
        
        return thresholds
    
    async def _analyze_recent_patterns(
        self, historical_data: List[Dict[str, Any]], data_type: str
    ) -> Dict[str, Any]:
        """Analyze recent patterns for trend detection."""
        if not historical_data:
            return {}
        
        try:
            df = pd.DataFrame(historical_data)
            if df.empty:
                return {}
            
            # Get data from last 24 hours for trend analysis
            df['timestamp'] = pd.to_datetime(df['created_at'])
            recent_cutoff = datetime.now() - timedelta(hours=24)
            recent_df = df[df['timestamp'] >= recent_cutoff]
            
            patterns = {
                'total_recent_records': len(recent_df),
                'recent_data_available': len(recent_df) > 0,
                'data_frequency': 'normal'
            }
            
            if len(recent_df) > 0:
                # Calculate hourly patterns
                recent_df['hour'] = recent_df['timestamp'].dt.hour
                hourly_counts = recent_df.groupby('hour').size()
                
                patterns['peak_hour'] = hourly_counts.idxmax() if len(hourly_counts) > 0 else None
                patterns['min_hour'] = hourly_counts.idxmin() if len(hourly_counts) > 0 else None
                patterns['hourly_variance'] = hourly_counts.var() if len(hourly_counts) > 1 else 0
            
            return patterns
            
        except Exception as e:
            print(f"Error analyzing recent patterns: {e}")
            return {}
    
    def _build_detection_prompt(
        self,
        data_type: str,
        time_range: Dict[str, datetime],
        sensitivity: float,
        context: AnomalyContext
    ) -> str:
        """Build the prompt for the AI agent."""
        prompt = f"""
        Analyze the following data for anomalies:
        
        Data Type: {data_type}
        Time Range: {time_range['start'].strftime('%Y-%m-%d %H:%M')} to {time_range['end'].strftime('%Y-%m-%d %H:%M')}
        Detection Sensitivity: {sensitivity} (0=least sensitive, 1=most sensitive)
        
        Historical Data Overview:
        - Total records analyzed: {len(context.historical_data)}
        
        Baseline Metrics:
        {context.baseline_metrics}
        
        Alert Thresholds:
        {context.alert_thresholds}
        
        Recent Patterns:
        {context.recent_patterns}
        
        Please identify anomalies and provide:
        1. List of detected anomalies with severity levels
        2. Description of each anomaly
        3. Affected entities (products, customers, warehouses, etc.)
        4. Recommended actions for each anomaly
        5. Overall confidence in the analysis
        6. Suggested next check time
        
        Focus on anomalies that could impact:
        - Revenue and sales
        - Customer satisfaction
        - Inventory accuracy
        - Data integrity
        - System performance
        
        Categorize severity as: low, medium, high, or critical
        """
        
        return prompt
    
    def _enhance_detection_result(
        self,
        result: AnomalyDetectionResponse,
        context: AnomalyContext,
        time_range: Dict[str, datetime]
    ) -> AnomalyDetectionResponse:
        """Enhance the AI result with additional analysis."""
        
        # Ensure we have basic result structure
        if not hasattr(result, 'anomalies') or not result.anomalies:
            # Create sample anomaly if none detected
            result.anomalies = []
        
        # Set metadata
        result.total_anomalies = len(result.anomalies)
        result.analysis_period = time_range
        
        if not hasattr(result, 'model_confidence') or result.model_confidence == 0:
            # Calculate confidence based on data quality
            data_quality_score = min(len(context.historical_data) / 100, 1.0)
            baseline_quality_score = min(len(context.baseline_metrics) / 10, 1.0)
            result.model_confidence = (data_quality_score + baseline_quality_score) / 2
        
        if not hasattr(result, 'next_check_recommended') or not result.next_check_recommended:
            # Recommend next check based on detected anomalies
            if result.total_anomalies > 0:
                critical_anomalies = sum(1 for a in result.anomalies if a.severity == 'critical')
                if critical_anomalies > 0:
                    result.next_check_recommended = datetime.now() + timedelta(minutes=15)
                else:
                    result.next_check_recommended = datetime.now() + timedelta(hours=1)
            else:
                result.next_check_recommended = datetime.now() + timedelta(hours=4)
        
        return result