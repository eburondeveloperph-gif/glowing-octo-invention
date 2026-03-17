/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// FIX: Refactored to use composition over inheritance for EventEmitter
export class AudioRecorder {
  // FIX: Use an internal EventEmitter instance
  private emitter = new EventEmitter();

  // FIX: Expose on/off methods
  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {}

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    this.starting = new Promise(async (resolve, reject) => {
      const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(supported.channelCount && { channelCount: { ideal: 1, min: 1 } }),
          ...(supported.sampleRate && { sampleRate: { ideal: this.sampleRate, min: 16000 } }),
        },
      });
      this.audioContext = await audioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      const t = this.audioContext.currentTime;

      // Highpass: cut rumble, HVAC, handling noise below 80Hz
      const highpassFilter = this.audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.setValueAtTime(80, t);
      highpassFilter.Q.setValueAtTime(0.7, t);

      // Notch filter: cut 50/60Hz mains hum (55Hz catches both EU/US)
      const notchFilter = this.audioContext.createBiquadFilter();
      notchFilter.type = 'notch';
      notchFilter.frequency.setValueAtTime(55, t);
      notchFilter.Q.setValueAtTime(8, t);

      // Lowpass: cut hiss and non-speech above 7kHz (speech fundamentals < 4kHz)
      const lowpassFilter = this.audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.setValueAtTime(7000, t);
      lowpassFilter.Q.setValueAtTime(0.7, t);

      // Compressor: normalize speech dynamics, boost quiet speech
      const compressor = this.audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-42, t);
      compressor.knee.setValueAtTime(24, t);
      compressor.ratio.setValueAtTime(6, t);
      compressor.attack.setValueAtTime(0.002, t);
      compressor.release.setValueAtTime(0.12, t);

      // Gain: boost quiet speech for better transcription
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(1.4, t);

      // Chain: source -> highpass -> notch -> lowpass -> compressor -> gain -> worklets
      this.source.connect(highpassFilter);
      highpassFilter.connect(notchFilter);
      notchFilter.connect(lowpassFilter);
      lowpassFilter.connect(compressor);
      compressor.connect(gainNode);

      const workletName = 'audio-recorder-worklet';
      const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

      await this.audioContext.audioWorklet.addModule(src);
      this.recordingWorklet = new AudioWorkletNode(
        this.audioContext,
        workletName
      );

      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        // Worklet processes recording floats and messages converted buffer
        const arrayBuffer = ev.data.data.int16arrayBuffer;

        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          // FIX: Changed this.emit to this.emitter.emit
          this.emitter.emit('data', arrayBufferString);
        }
      };
      gainNode.connect(this.recordingWorklet);

      // vu meter worklet
      const vuWorkletName = 'vu-meter';
      await this.audioContext.audioWorklet.addModule(
        createWorketFromSrc(vuWorkletName, VolMeterWorket)
      );
      this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
      this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
        // FIX: Changed this.emit to this.emitter.emit
        this.emitter.emit('volume', ev.data.volume);
      };

      gainNode.connect(this.vuWorklet);
      this.recording = true;
      resolve();
      this.starting = null;
    });
  }

  stop() {
    // It is plausible that stop would be called before start completes,
    // such as if the Websocket immediately hangs up
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}