// Pengenalan wajah berjalan DI BROWSER: tidak ada round-trip server saat scan.
const Face = {
  base: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/',
  ready: null,
  load() {
    if (!this.ready) this.ready = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(this.base),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(this.base),
      faceapi.nets.faceRecognitionNet.loadFromUri(this.base)
    ]);
    return this.ready;
  },
  async start(video) {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    await video.play();
  },
  stop(video) { if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop()); },
  async detect(video) {
    const r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true).withFaceDescriptor();
    return r ? { desc: Array.from(r.descriptor) } : null;
  },
  match(desc, list, thr = 0.5) {
    let best = null, bd = 9;
    for (const p of list) {
      let s = 0;
      for (let i = 0; i < 128; i++) { const x = desc[i] - p.d[i]; s += x * x; }
      s = Math.sqrt(s);
      if (s < bd) { bd = s; best = p; }
    }
    return best && bd < thr ? { p: best, acc: Math.round((1 - bd) * 100) } : null;
  }
};
