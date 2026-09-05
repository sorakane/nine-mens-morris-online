// Original, softly swung lounge loop, composed for this game.
const chords = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [50, 57, 60, 65],
  [43, 50, 53, 59],
  [48, 55, 57, 64],
  [45, 52, 59, 64],
  [50, 53, 57, 60],
  [43, 53, 57, 62],
];
const melody = [
  [76, 0, 79, 74, 0, 72, 74, 0],
  [76, 72, 0, 71, 0, 69, 72, 0],
  [74, 0, 77, 76, 74, 0, 69, 0],
  [71, 74, 0, 77, 0, 74, 71, 0],
  [72, 0, 76, 79, 81, 0, 79, 76],
  [76, 0, 71, 72, 0, 76, 79, 0],
  [77, 74, 0, 72, 69, 0, 74, 0],
  [71, 0, 74, 69, 0, 67, 71, 0],
];
export class TableMusic {
  private context: AudioContext;
  private master: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  constructor(onState: (playing: boolean) => void) {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.2;
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 4;
    this.master.connect(limiter);
    limiter.connect(this.context.destination);
    this.context.onstatechange = () =>
      onState(this.context.state === 'running');
  }
  setVolume(value: number) {
    this.master.gain.setTargetAtTime(
      value / 100,
      this.context.currentTime,
      0.1,
    );
  }
  private note(
    midi: number,
    when: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) {
    const osc = this.context.createOscillator(),
      gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.04);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private schedule() {
    if (this.context.state !== 'running') return;
    if (this.next < this.context.currentTime - 0.5)
      this.next = this.context.currentTime + 0.04;
    while (this.next < this.context.currentTime + 0.35) {
      const bar = Math.floor(this.step / 8) % 8,
        beat = this.step % 8,
        chord = chords[bar],
        time = this.next;
      if (beat === 0 || beat === 4) this.note(chord[0], time, 1, 0.17);
      if (beat === 0 || beat === 3 || beat === 6)
        chord
          .slice(1)
          .forEach((n, i) =>
            this.note(n, time + i * 0.015, 1.25, 0.035, 'triangle'),
          );
      const m = melody[bar][beat];
      if (m) {
        this.note(m, time, 0.65, 0.1);
        this.note(m + 12, time, 0.16, 0.018);
      }
      if (beat === 2 || beat === 6)
        this.note(91, time, 0.06, 0.012, 'triangle');
      this.step++;
      this.next += (60 / 88 / 2) * (beat % 2 === 0 ? 1.08 : 0.92);
    }
  }
  async play() {
    await this.context.resume();
    if (!this.timer) {
      this.next = this.context.currentTime + 0.05;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 100);
    }
  }
  async pause() {
    await this.context.suspend();
  }
  close() {
    if (this.timer) clearInterval(this.timer);
    this.context.onstatechange = null;
    void this.context.close();
  }
}
