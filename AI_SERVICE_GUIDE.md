# AI Service Development Guide

## Overview

The TruthSource AI Service provides intelligent forecasting, prediction, and anomaly detection capabilities using Pydantic AI. This service integrates seamlessly with the main Next.js application to enable:

- **Demand Forecasting**: AI-powered predictions of future product demand
- **Delivery Prediction**: Intelligent delivery time estimates based on multiple factors
- **Anomaly Detection**: Real-time monitoring for data inconsistencies and issues

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│   AI Service    │────▶│   OpenAI API    │
│  (Frontend)     │     │  (Pydantic AI)  │     │   (GPT-4o-mini) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                              Supabase
                           (Data Source)
```

## Quick Start

### Prerequisites

- Python 3.11+
- OpenAI API key
- Supabase credentials

### Development Setup

1. **Navigate to AI service directory**
   ```bash
   cd ai-service
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Install and run**
   ```bash
   ./run.sh dev
   ```

   Or manually:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python main.py
   ```

4. **Test the service**
   ```bash
   curl http://localhost:8000/health
   ```

## API Endpoints

### Health Check
```
GET /health
```

### Demand Forecasting
```
POST /api/v1/forecast/demand
Content-Type: application/json

{
  "product_ids": ["prod_123", "prod_456"],
  "warehouse_ids": ["warehouse_1"],
  "forecast_days": 30,
  "include_seasonality": true
}
```

### Delivery Prediction
```
POST /api/v1/predict/delivery
Content-Type: application/json

{
  "origin_warehouse": "warehouse_1",
  "destination_address": {
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  },
  "product_ids": ["prod_123"],
  "carrier": "fedex",
  "service_level": "standard"
}
```

### Anomaly Detection
```
POST /api/v1/detect/anomalies
Content-Type: application/json

{
  "data_type": "inventory",
  "time_range": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z"
  },
  "sensitivity": 0.7,
  "include_recommendations": true
}
```

## Pydantic AI Agents

### DemandForecastingAgent
- Analyzes historical sales data
- Considers seasonal patterns
- Provides confidence scores
- Handles multiple products/warehouses

### DeliveryPredictionAgent
- Factors in carrier performance
- Considers weather and geography
- Provides alternative options
- Real-time transit calculations

### AnomalyDetectionAgent
- Monitors inventory, pricing, and orders
- Statistical and AI-based detection
- Severity classification
- Actionable recommendations

## Integration with Next.js

### Client Library
```typescript
import { aiServiceClient } from '@/lib/ai/client'

// Forecast demand
const forecast = await aiServiceClient.forecastDemand({
  product_ids: ['prod_123'],
  forecast_days: 30
})

// Predict delivery
const delivery = await aiServiceClient.predictDelivery({
  origin_warehouse: 'warehouse_1',
  destination_address: { city: 'SF', state: 'CA', zip: '94105' },
  product_ids: ['prod_123']
})
```

### React Hooks
```typescript
import { useDemandForecast, useAnomalyMonitoring } from '@/hooks/use-ai-service'

function MyComponent() {
  const demandForecast = useDemandForecast()
  const { anomalies, totalAnomalies } = useAnomalyMonitoring()
  
  // Use AI capabilities in your components
}
```

### Components
```typescript
import { AIServiceStatus, AnomalyMonitor } from '@/components/ai'

// Show AI service status and anomaly monitoring
```

## Deployment

### Docker
```bash
# Build AI service
cd ai-service
docker build -t truthsource-ai-service .

# Run with Docker Compose
cd ..
docker-compose up
```

### Vercel + Railway/Render
1. Deploy Next.js app to Vercel
2. Deploy AI service to Railway/Render
3. Set environment variables in both platforms

### Environment Variables

**AI Service (.env)**
```
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
HOST=0.0.0.0
PORT=8000
```

**Next.js App (.env.local)**
```
NEXT_PUBLIC_AI_SERVICE_URL=https://your-ai-service.railway.app
# ... other existing variables
```

## Development Commands

```bash
# Setup development environment
./run.sh setup

# Run development server
./run.sh run

# Run tests (when implemented)
./run.sh test

# Build Docker image
./run.sh docker
```

## Monitoring and Logging

The AI service includes:
- Health check endpoint for monitoring
- Structured logging for debugging
- Error handling and retry logic
- Performance metrics (planned)

## Security Considerations

- API keys stored in environment variables
- CORS configured for Next.js app only
- Input validation on all endpoints
- Rate limiting (planned)
- Authentication integration (planned)

## Troubleshooting

### Common Issues

1. **OpenAI API errors**: Verify API key and quota
2. **Supabase connection**: Check URL and service role key
3. **Port conflicts**: Ensure port 8000 is available
4. **CORS errors**: Verify Next.js app URL in CORS settings

### Logs
```bash
# View service logs
docker-compose logs ai-service

# Debug mode
DEBUG=true python main.py
```

## Contributing

1. Follow existing code patterns
2. Add tests for new agents/endpoints
3. Update documentation
4. Ensure error handling

## Future Enhancements

- [ ] Model fine-tuning on historical data
- [ ] Advanced forecasting algorithms
- [ ] Real-time streaming predictions
- [ ] Integration with external APIs
- [ ] Performance optimization
- [ ] A/B testing framework