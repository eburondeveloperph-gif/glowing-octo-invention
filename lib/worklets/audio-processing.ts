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

const AudioRecordingWorklet = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  buffer = new Int16Array(2048);
  bufferWriteIndex = 0;

  // Soft noise gate: attenuate (not zero) when below threshold to reduce noise floor
  NOISE_FLOOR = 0.0015;
  GATE_ATTENUATION = 0.12;
  RMS_SMOOTHING = 0.88;

  rmsHistory = 0;

  process(inputs) {
    if (inputs[0]?.length) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  sendAndClearBuffer() {
    this.port.postMessage({
      event: "chunk",
      data: { int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer },
    });
    this.bufferWriteIndex = 0;
  }

  processChunk(float32Array) {
    const l = float32Array.length;
    let sumSq = 0;
    for (let i = 0; i < l; i++) sumSq += float32Array[i] * float32Array[i];
    const rms = Math.sqrt(sumSq / l);
    this.rmsHistory = this.rmsHistory * this.RMS_SMOOTHING + rms * (1 - this.RMS_SMOOTHING);

    const gate = rms < this.NOISE_FLOOR
      ? this.GATE_ATTENUATION
      : rms < this.NOISE_FLOOR * 2
        ? this.GATE_ATTENUATION + (1 - this.GATE_ATTENUATION) * ((rms - this.NOISE_FLOOR) / this.NOISE_FLOOR)
        : 1;

    for (let i = 0; i < l; i++) {
      const gated = float32Array[i] * gate;
      const int16Value = Math.max(-32768, Math.min(32767, gated * 32768));
      this.buffer[this.bufferWriteIndex++] = int16Value;
      if (this.bufferWriteIndex >= this.buffer.length) this.sendAndClearBuffer();
    }
    if (this.bufferWriteIndex >= this.buffer.length) this.sendAndClearBuffer();
  }
}
`;

export default AudioRecordingWorklet;
