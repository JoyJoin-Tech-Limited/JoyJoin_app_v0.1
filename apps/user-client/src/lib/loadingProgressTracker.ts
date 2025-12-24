/**
 * Loading Progress Tracker
 * 追踪图片加载进度，显示百分比进度条
 */

export interface ProgressState {
  loaded: number;
  total: number;
  percentage: number;
  isComplete: boolean;
}

export class LoadingProgressTracker {
  private loaded = 0;
  private total = 0;
  private callbacks: ((state: ProgressState) => void)[] = [];

  constructor(totalImages: number) {
    this.total = totalImages;
  }

  onProgress(callback: (state: ProgressState) => void) {
    this.callbacks.push(callback);
  }

  increment() {
    this.loaded++;
    this.notifyProgress();
  }

  private notifyProgress() {
    const percentage = this.total > 0 ? Math.round((this.loaded / this.total) * 100) : 0;
    const state: ProgressState = {
      loaded: this.loaded,
      total: this.total,
      percentage: Math.min(percentage, 99), // Cap at 99% until fully loaded
      isComplete: this.loaded >= this.total,
    };

    this.callbacks.forEach(cb => cb(state));
  }

  complete() {
    this.loaded = this.total;
    this.notifyProgress();
  }
}
