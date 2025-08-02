// Performance limits and expectations by subscription tier
export const tierLimits = {
  free: {
    rps: 20,                    // Requests per second
    concurrent_users: 10,       // Max concurrent users
    daily_requests: 10000,      // Daily request limit
    error_threshold: 0.05,      // 5% error rate threshold
    response_time_p95: 1000,    // 95th percentile response time (ms)
    bulk_operations: {
      enabled: false,
      max_items: 0,
    },
    reports: {
      enabled: true,
      max_per_hour: 1,
      max_execution_time: 30000, // 30 seconds
    },
  },
  
  starter: {
    rps: 200,
    concurrent_users: 50,
    daily_requests: 100000,
    error_threshold: 0.02,
    response_time_p95: 500,
    bulk_operations: {
      enabled: true,
      max_items: 100,
    },
    reports: {
      enabled: true,
      max_per_hour: 10,
      max_execution_time: 60000, // 1 minute
    },
  },
  
  professional: {
    rps: 2000,
    concurrent_users: 500,
    daily_requests: 1000000,
    error_threshold: 0.01,
    response_time_p95: 300,
    bulk_operations: {
      enabled: true,
      max_items: 1000,
    },
    reports: {
      enabled: true,
      max_per_hour: 100,
      max_execution_time: 300000, // 5 minutes
    },
  },
  
  enterprise: {
    rps: 10000,
    concurrent_users: 5000,
    daily_requests: -1,         // Unlimited
    error_threshold: 0.005,
    response_time_p95: 200,
    bulk_operations: {
      enabled: true,
      max_items: 10000,
    },
    reports: {
      enabled: true,
      max_per_hour: -1,         // Unlimited
      max_execution_time: 600000, // 10 minutes
    },
  },
}

// Load distribution for realistic testing
export const tierDistribution = {
  free: 0.5,        // 50% of users
  starter: 0.3,     // 30% of users
  professional: 0.15, // 15% of users
  enterprise: 0.05,  // 5% of users
}

// Performance SLAs by tier
export const slaTargets = {
  free: {
    uptime: 0.99,     // 99% uptime
    availability: 'business_hours', // 9-5 support
    response_time_sla: 2000, // 2 second SLA
  },
  starter: {
    uptime: 0.995,    // 99.5% uptime
    availability: 'extended_hours', // 7am-10pm support
    response_time_sla: 1000, // 1 second SLA
  },
  professional: {
    uptime: 0.999,    // 99.9% uptime
    availability: '24x5', // 24x5 support
    response_time_sla: 500, // 500ms SLA
  },
  enterprise: {
    uptime: 0.9999,   // 99.99% uptime
    availability: '24x7', // 24x7 support
    response_time_sla: 200, // 200ms SLA
  },
}

// Rate limit configurations by tier
export const rateLimitConfig = {
  free: {
    window: '1m',
    limit: 100,
    burst: 20,
  },
  starter: {
    window: '1m',
    limit: 1000,
    burst: 200,
  },
  professional: {
    window: '1m',
    limit: 10000,
    burst: 2000,
  },
  enterprise: {
    window: '1m',
    limit: 100000,
    burst: 20000,
  },
}

// Get tier-specific options for k6 tests
export function getTierOptions(tier) {
  const limits = tierLimits[tier]
  
  return {
    stages: [
      { duration: '2m', target: limits.concurrent_users / 2 },
      { duration: '5m', target: limits.concurrent_users },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: [`p(95)<${limits.response_time_p95}`],
      http_req_failed: [`rate<${limits.error_threshold}`],
      http_reqs: [`rate>=${limits.rps * 0.8}`], // 80% of max RPS
    },
  }
}