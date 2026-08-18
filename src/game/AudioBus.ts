export class AudioBus {
  private static ctx?: AudioContext;
  static muted = localStorage.getItem('rymdjojjo-muted') === '1';
  static musicEnabled = localStorage.getItem('rymdjojjo-music-enabled') !== '0';

  static unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  static toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('rymdjojjo-muted', this.muted ? '1' : '0');
    if (!this.muted) {
      this.unlock();
      this.tone(620, 0.08, 'sine', 0.05);
    }
    return this.muted;
  }

  static setEffectsEnabled(enabled: boolean): void {
    this.muted = !enabled;
    localStorage.setItem('rymdjojjo-muted', this.muted ? '1' : '0');
    if (enabled) {
      this.unlock();
      this.tone(620, 0.08, 'sine', 0.05);
    }
  }

  static setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    localStorage.setItem('rymdjojjo-music-enabled', enabled ? '1' : '0');
  }

  static tone(freq: number, duration = 0.1, wave: OscillatorType = 'sine', volume = 0.04, slide = 0): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }

  static coin(): void { this.tone(820, 0.09, 'sine', 0.045, 440); }
  static power(): void {
    this.tone(360, 0.22, 'triangle', 0.05, 480);
    window.setTimeout(() => this.tone(720, 0.16, 'sine', 0.04, 360), 80);
  }
  static hit(): void { this.tone(130, 0.28, 'sawtooth', 0.055, -70); }
  static paint(): void { this.tone(240, 0.06, 'square', 0.025, 90); }
  static launch(): void { this.tone(85, 0.8, 'sawtooth', 0.045, 140); }
}
