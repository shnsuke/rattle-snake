/* Workout player: a self-correcting timer (drift is measured against
 * performance.now(), not accumulated via setInterval ticks) plus audio
 * cues generated with the Web Audio API so no sound assets are needed
 * (keeps the app installable/offline with zero extra network fetches).
 */
(function (global) {
  function beep(ctx, freq, duration, gain) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    g.gain.value = gain != null ? gain : 0.15;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }

  class Player {
    constructor(segments, callbacks) {
      this.segments = segments;
      this.totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
      this.cb = callbacks || {};
      this.elapsed = 0;
      this.running = false;
      this._raf = null;
      this._lastTs = null;
      this._lastSegIndex = -1;
      this._countInPlayed = new Set();
      this._audioCtx = null;
      this._wakeLock = null;
    }

    _ensureAudio() {
      if (!this._audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this._audioCtx = new AC();
      }
      if (this._audioCtx && this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }
    }

    async _lockWake() {
      try {
        if ('wakeLock' in navigator) {
          this._wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (e) { /* ignore: not fatal if wake lock is unavailable */ }
    }
    _releaseWake() {
      if (this._wakeLock) { this._wakeLock.release().catch(() => {}); this._wakeLock = null; }
    }

    segmentAt(t) {
      for (let i = 0; i < this.segments.length; i++) {
        const seg = this.segments[i];
        if (t < seg.start + seg.duration || i === this.segments.length - 1) return i;
      }
      return this.segments.length - 1;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._ensureAudio();
      this._lockWake();
      this._lastTs = performance.now();
      const loop = (ts) => {
        if (!this.running) return;
        const dt = (ts - this._lastTs) / 1000;
        this._lastTs = ts;
        this.elapsed = Math.min(this.totalDuration, this.elapsed + dt);
        this._tick();
        if (this.elapsed >= this.totalDuration) {
          this.pause();
          if (this.cb.onFinish) this.cb.onFinish();
          return;
        }
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    pause() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._releaseWake();
    }

    reset() {
      this.pause();
      this.elapsed = 0;
      this._lastSegIndex = -1;
      this._countInPlayed.clear();
      if (this.cb.onTick) this.cb.onTick(this._state());
    }

    seekToSegment(index) {
      index = Math.max(0, Math.min(this.segments.length - 1, index));
      this.elapsed = this.segments[index].start;
      this._lastSegIndex = -1;
      this._countInPlayed.clear();
      this._tick();
    }

    skip(deltaSeconds) {
      this.elapsed = Math.max(0, Math.min(this.totalDuration - 0.001, this.elapsed + deltaSeconds));
      this._tick();
    }

    _state() {
      const idx = this.segmentAt(this.elapsed);
      const seg = this.segments[idx];
      const remaining = seg.start + seg.duration - this.elapsed;
      return {
        elapsed: this.elapsed,
        totalDuration: this.totalDuration,
        segmentIndex: idx,
        segment: seg,
        remainingInSegment: remaining,
        remainingTotal: this.totalDuration - this.elapsed,
      };
    }

    _tick() {
      const state = this._state();
      if (state.segmentIndex !== this._lastSegIndex) {
        this._lastSegIndex = state.segmentIndex;
        this._countInPlayed.clear();
        beep(this._audioCtx, state.segment.power >= 100 ? 880 : 440, 0.18, 0.18);
        if (this.cb.onSegmentChange) this.cb.onSegmentChange(state);
      }
      const remainInt = Math.ceil(state.remainingInSegment);
      if (remainInt <= 3 && remainInt >= 1 && !this._countInPlayed.has(remainInt)
          && state.remainingInSegment <= remainInt) {
        this._countInPlayed.add(remainInt);
        beep(this._audioCtx, 660, 0.08, 0.12);
      }
      if (this.cb.onTick) this.cb.onTick(state);
    }
  }

  global.RSPlayer = { Player };
})(window);
