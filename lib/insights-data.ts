import { logger } from './logger';

const log = logger.child('InsightsData');

export class LinearRegression {
  private slope: number = 0;
  private intercept: number = 0;
  private r2: number = 0;

  fit(scores: number[]) {
    const n = scores.length;
    if (n < 2) return this;
    const X = scores.map((_, i) => i);
    const Y = scores;
    const sumX = X.reduce((a, b) => a + b, 0);
    const sumY = Y.reduce((a, b) => a + b, 0);
    const sumXY = X.reduce((a, x, i) => a + x * Y[i], 0);
    const sumX2 = X.reduce((a, x) => a + x * x, 0);
    this.slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    this.intercept = (sumY - this.slope * sumX) / n;
    const meanY = sumY / n;
    const ssTotal = Y.reduce((a, y) => a + (y - meanY) ** 2, 0);
    const ssResidual = Y.reduce((a, y, i) => a + (y - (this.slope * i + this.intercept)) ** 2, 0);
    this.r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    log.debug('Linear regression fitted', { slope: this.slope, r2: this.r2, n });
    return this;
  }

  predict(nextIndex: number): number { return Math.round((this.slope * nextIndex + this.intercept) * 10) / 10; }
  getSlope(): number { return Math.round(this.slope * 100) / 100; }
  getR2(): number { return Math.round(this.r2 * 100) / 100; }
  getTrend(): string { if (this.slope > 2) return 'accelerating'; if (this.slope > 0.5) return 'improving'; if (this.slope > -0.5) return 'stable'; if (this.slope > -2) return 'declining'; return 'at-risk'; }
  getStatus(): string { if (this.slope < -1) return 'Burnout Risk'; if (this.slope > 2) return 'Accelerated Growth'; return 'Stable'; }
}
