#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const [,, resultsPath, baselinePath] = process.argv;

if (!resultsPath || !baselinePath) {
  console.error('Usage: node check-performance-regression.js <results.json> <baseline.json>');
  process.exit(1);
}

try {
  // Load test results and baseline
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  const regressions = [];
  const improvements = [];
  
  // Check HTTP request metrics
  if (results.metrics?.http_req_duration?.values) {
    const metrics = results.metrics.http_req_duration.values;
    
    // Check P95 response time
    const baselineP95 = baseline.endpoints?.['/api/products']?.p95 || 500;
    const currentP95 = metrics['p(95)'];
    
    if (currentP95 > baselineP95 * 1.1) { // 10% regression threshold
      regressions.push({
        metric: 'P95 Response Time',
        baseline: `${baselineP95}ms`,
        current: `${currentP95.toFixed(2)}ms`,
        change: `+${((currentP95 - baselineP95) / baselineP95 * 100).toFixed(2)}%`
      });
    } else if (currentP95 < baselineP95 * 0.9) { // 10% improvement
      improvements.push({
        metric: 'P95 Response Time',
        baseline: `${baselineP95}ms`,
        current: `${currentP95.toFixed(2)}ms`,
        change: `${((currentP95 - baselineP95) / baselineP95 * 100).toFixed(2)}%`
      });
    }
  }

  // Check error rate
  if (results.metrics?.http_req_failed?.values) {
    const errorRate = results.metrics.http_req_failed.values.rate;
    const baselineErrorRate = baseline.endpoints?.['/api/products']?.error_rate || 0.001;
    
    if (errorRate > baselineErrorRate * 2) { // 2x regression threshold for errors
      regressions.push({
        metric: 'Error Rate',
        baseline: `${(baselineErrorRate * 100).toFixed(3)}%`,
        current: `${(errorRate * 100).toFixed(3)}%`,
        change: `+${((errorRate - baselineErrorRate) / baselineErrorRate * 100).toFixed(2)}%`
      });
    }
  }

  // Check throughput
  if (results.metrics?.http_reqs?.values) {
    const duration = results.state?.testRunDurationMs || 1000;
    const totalRequests = results.metrics.http_reqs.values.count;
    const rps = totalRequests / (duration / 1000);
    const baselineRps = baseline.endpoints?.['/api/products']?.requests_per_second || 1000;
    
    if (rps < baselineRps * 0.8) { // 20% throughput regression
      regressions.push({
        metric: 'Throughput (RPS)',
        baseline: `${baselineRps}`,
        current: `${rps.toFixed(2)}`,
        change: `${((rps - baselineRps) / baselineRps * 100).toFixed(2)}%`
      });
    }
  }

  // Generate report
  console.log('\n=== Performance Regression Check ===\n');
  
  if (regressions.length === 0 && improvements.length === 0) {
    console.log('✅ No significant performance changes detected');
  } else {
    if (improvements.length > 0) {
      console.log('📈 Performance Improvements:');
      console.table(improvements);
    }
    
    if (regressions.length > 0) {
      console.log('\n⚠️  Performance Regressions Detected:');
      console.table(regressions);
      
      // Write regression report
      const report = {
        timestamp: new Date().toISOString(),
        test: path.basename(resultsPath),
        regressions,
        improvements,
        summary: {
          hasRegressions: true,
          regressionCount: regressions.length,
          improvementCount: improvements.length
        }
      };
      
      fs.writeFileSync('regression-report.json', JSON.stringify(report, null, 2));
      console.log('\nRegression report saved to: regression-report.json');
      
      // Exit with error code to fail CI
      process.exit(1);
    }
  }
  
  console.log('\n==================================\n');
  
} catch (error) {
  console.error('Error checking performance regression:', error);
  process.exit(1);
}