/**
 * Animation Performance Monitor
 * 实时监控动画 FPS 和性能指标
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  totalFrames: number;
  memoryUsage?: number;
}

export class AnimationPerformanceMonitor {
  private frameCount = 0;
  private droppedFrames = 0;
  private lastTimestamp = performance.now();
  private frameTimings: number[] = [];
  private isMonitoring = false;
  private animationId: number | null = null;

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.lastTimestamp = performance.now();
    this.frameTimings = [];
    this.monitor();
  }

  stop() {
    this.isMonitoring = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private monitor() {
    const now = performance.now();
    const deltaTime = now - this.lastTimestamp;
    
    // 60fps = 16.67ms per frame, allow 5ms variance
    if (deltaTime > 21.67) {
      this.droppedFrames++;
    }

    this.frameTimings.push(deltaTime);
    if (this.frameTimings.length > 60) {
      this.frameTimings.shift();
    }

    this.frameCount++;
    this.lastTimestamp = now;

    if (this.isMonitoring) {
      this.animationId = requestAnimationFrame(() => this.monitor());
    }
  }

  getMetrics(): PerformanceMetrics {
    const avgFrameTime = this.frameTimings.length > 0
      ? this.frameTimings.reduce((a, b) => a + b, 0) / this.frameTimings.length
      : 16.67;

    const fps = Math.round(1000 / avgFrameTime);

    return {
      fps: Math.min(fps, 60),
      frameTime: Math.round(avgFrameTime * 100) / 100,
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount,
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
    };
  }

  /**
   * Check if performance is acceptable
   * 返回 true 如果 FPS >= 50
   */
  isPerformanceAcceptable(): boolean {
    const metrics = this.getMetrics();
    return metrics.fps >= 50;
  }
}

export const createPerformanceMonitor = () => {
  return new AnimationPerformanceMonitor();
};
