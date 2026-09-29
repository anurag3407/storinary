#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
if (fs.existsSync(dist)) {
  const webgpuSrc = path.join(dist, 'ort.webgpu.min.js');
  const webgpuDst = path.join(dist, 'ort.webgpu.bundle.min.mjs');
  if (fs.existsSync(webgpuSrc) && !fs.existsSync(webgpuDst)) {
    try {
      fs.copyFileSync(webgpuSrc, webgpuDst);
    } catch (_) {}
  }
  const nodeSrc = path.join(dist, 'ort.node.min.js');
  const nodeDst = path.join(dist, 'ort.node.min.mjs');
  if (fs.existsSync(nodeSrc) && !fs.existsSync(nodeDst)) {
    try {
      fs.copyFileSync(nodeSrc, nodeDst);
    } catch (_) {}
  }
}
