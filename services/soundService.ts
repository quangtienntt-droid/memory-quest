
class SoundService {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;
  private masterGain: GainNode | null = null;
  
  // Ambient Music Nodes
  private ambientNodes: { osc: OscillatorNode, gain: GainNode, filter?: BiquadFilterNode }[] = [];
  private ambientMasterGain: GainNode | null = null;
  private isPlayingAmbient: boolean = false;
  private melodyTimer: number | null = null;

  constructor() {
    try {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3; // Master volume for SFX

      // Setup Ambient Bus
      this.ambientMasterGain = this.ctx.createGain();
      this.ambientMasterGain.connect(this.ctx.destination);
      this.ambientMasterGain.gain.value = 0; // Start silent
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  toggle(enabled: boolean) {
    this.isEnabled = enabled;
    if (this.isEnabled) {
        if (this.ctx?.state === 'suspended') {
            this.ctx.resume();
        }
        this.startAmbient();
    } else {
        this.stopAmbient();
    }
  }

  private startAmbient() {
    if (!this.ctx || !this.ambientMasterGain || this.isPlayingAmbient) return;
    
    this.isPlayingAmbient = true;
    this.ambientMasterGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 2); // Fade in

    // 1. Create a deep, warm drone chord (Cmaj9)
    const freqs = [65.41, 130.81, 196.00, 246.94, 293.66]; // C2, C3, G3, B3, D4
    
    freqs.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = i === 0 ? 'sine' : 'triangle'; // Pure bass, textured mids
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() * 8) - 4; 

        filter.type = 'lowpass';
        filter.frequency.value = 300 + (Math.random() * 200);
        filter.Q.value = 1;

        // Subtle LFO modulation on the filter for organic movement
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.05 + (Math.random() * 0.1);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 50;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        gain.gain.value = (i === 0 ? 0.15 : 0.05) / freqs.length;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientMasterGain!);
        
        osc.start();
        this.ambientNodes.push({ osc, gain, filter });
    });

    // 2. Start a procedural "Glimmer" melody
    this.scheduleMelody();
  }

  private scheduleMelody() {
    if (!this.isPlayingAmbient || !this.ctx) return;

    const nextNoteDelay = 2000 + Math.random() * 4000; // Slow, sparse notes
    this.melodyTimer = window.setTimeout(() => {
        this.playAmbientNote();
        this.scheduleMelody();
    }, nextNoteDelay);
  }

  private playAmbientNote() {
    if (!this.ctx || !this.ambientMasterGain || !this.isEnabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const delay = this.ctx.createDelay();
    const feedback = this.ctx.createGain();

    // Pentatonic scale notes for a dreamy feel (C5 - C6 range)
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    osc.type = 'sine';
    osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];

    // Soft envelope
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 5);

    // Simple delay/echo effect
    delay.delayTime.value = 0.4;
    feedback.gain.value = 0.3;

    osc.connect(gain);
    gain.connect(this.ambientMasterGain);
    
    // Echo loop
    gain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.ambientMasterGain);

    osc.start(now);
    osc.stop(now + 6);
  }

  private stopAmbient() {
    if (!this.ctx || !this.ambientMasterGain) return;
    this.isPlayingAmbient = false;
    
    if (this.melodyTimer) {
        clearTimeout(this.melodyTimer);
        this.melodyTimer = null;
    }

    // Fade out
    this.ambientMasterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);

    // Cleanup nodes after fade out
    setTimeout(() => {
        this.ambientNodes.forEach(node => {
            try {
                node.osc.stop();
                node.osc.disconnect();
                node.gain.disconnect();
                node.filter?.disconnect();
            } catch (e) {}
        });
        this.ambientNodes = [];
    }, 600);
  }

  playFlip() {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00]; 
    osc.frequency.value = notes[Math.floor(Math.random() * notes.length)];
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playMatch() {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 987.77]; 
    
    chord.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        const startTime = now + (i * 0.05);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);
        
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(startTime);
        osc.stop(startTime + 2.5);
    });
  }

  playMismatch() {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 196.00; 
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
  
  playWin() {
    if (!this.isEnabled || !this.ctx || !this.masterGain) return;
    this.playMatch();
    setTimeout(() => this.playMatch(), 200);
    setTimeout(() => this.playMatch(), 400);
  }
}

export const soundService = new SoundService();
