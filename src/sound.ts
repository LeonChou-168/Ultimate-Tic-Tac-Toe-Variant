type AudioCue = 'move' | 'claim' | 'invalid' | 'settlement' | 'draw-offer' | 'draw-accepted' | 'draw-declined' | 'resign';

let audioContext: AudioContext | null = null;
let masterVolume = 0.72;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  return audioContext;
}

function createEnvelope(context: AudioContext, startAt: number, duration: number, peak = 0.045): GainNode {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak * masterVolume, 0.0001), startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  gain.connect(context.destination);
  return gain;
}

function playTone(context: AudioContext, frequency: number, startAt: number, duration: number, type: OscillatorType, peak?: number) {
  const oscillator = context.createOscillator();
  const gain = createEnvelope(context, startAt, duration, peak);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  oscillator.connect(gain);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function playSequence(context: AudioContext, notes: Array<{ frequency: number; delay: number; duration: number; type: OscillatorType; peak?: number }>) {
  const startAt = context.currentTime + 0.01;
  notes.forEach((note) => {
    playTone(context, note.frequency, startAt + note.delay, note.duration, note.type, note.peak);
  });
}

export function playSound(cue: AudioCue): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  switch (cue) {
    case 'move':
      playSequence(context, [
        { frequency: 392, delay: 0, duration: 0.09, type: 'sine', peak: 0.03 },
        { frequency: 523.25, delay: 0.045, duration: 0.12, type: 'triangle', peak: 0.025 },
      ]);
      break;
    case 'claim':
      playSequence(context, [
        { frequency: 523.25, delay: 0, duration: 0.1, type: 'triangle', peak: 0.035 },
        { frequency: 659.25, delay: 0.06, duration: 0.12, type: 'triangle', peak: 0.03 },
        { frequency: 783.99, delay: 0.13, duration: 0.18, type: 'sine', peak: 0.028 },
      ]);
      break;
    case 'invalid':
      playSequence(context, [
        { frequency: 210, delay: 0, duration: 0.08, type: 'sawtooth', peak: 0.018 },
        { frequency: 160, delay: 0.05, duration: 0.09, type: 'sawtooth', peak: 0.014 },
      ]);
      break;
    case 'settlement':
      playSequence(context, [
        { frequency: 392, delay: 0, duration: 0.1, type: 'triangle', peak: 0.028 },
        { frequency: 523.25, delay: 0.08, duration: 0.14, type: 'triangle', peak: 0.03 },
        { frequency: 659.25, delay: 0.18, duration: 0.2, type: 'sine', peak: 0.03 },
      ]);
      break;
    case 'draw-offer':
      playSequence(context, [
        { frequency: 349.23, delay: 0, duration: 0.08, type: 'sine', peak: 0.022 },
        { frequency: 440, delay: 0.08, duration: 0.11, type: 'sine', peak: 0.022 },
      ]);
      break;
    case 'draw-accepted':
      playSequence(context, [
        { frequency: 392, delay: 0, duration: 0.08, type: 'triangle', peak: 0.024 },
        { frequency: 493.88, delay: 0.07, duration: 0.11, type: 'triangle', peak: 0.024 },
        { frequency: 587.33, delay: 0.14, duration: 0.16, type: 'sine', peak: 0.024 },
      ]);
      break;
    case 'draw-declined':
      playSequence(context, [
        { frequency: 261.63, delay: 0, duration: 0.07, type: 'sine', peak: 0.02 },
        { frequency: 220, delay: 0.06, duration: 0.09, type: 'triangle', peak: 0.018 },
      ]);
      break;
    case 'resign':
      playSequence(context, [
        { frequency: 293.66, delay: 0, duration: 0.08, type: 'triangle', peak: 0.022 },
        { frequency: 246.94, delay: 0.08, duration: 0.1, type: 'triangle', peak: 0.022 },
        { frequency: 196, delay: 0.16, duration: 0.14, type: 'sine', peak: 0.02 },
      ]);
      break;
  }
}

export function setSoundVolume(volume: number): void {
  masterVolume = Math.min(1, Math.max(0, volume));
}
