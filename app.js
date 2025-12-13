// Frontend: calls backend API for video processing
// Backend handles all FFmpeg processing (no CORS issues)

const ui = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  loopGroup: document.getElementById("loopGroup"),
  formatGroup: document.getElementById("formatGroup"),
  qualitySelect: document.getElementById("qualitySelect"),
  processBtn: document.getElementById("processBtn"),
  resetBtn: document.getElementById("resetBtn"),
  primaryStart: document.getElementById("primaryStart"),
  secondaryLearn: document.getElementById("secondaryLearn"),
  downloadBtn: document.getElementById("downloadBtn"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  logArea: document.getElementById("logArea"),
  previewSlot: document.getElementById("previewSlot"),
  estimateSize: document.getElementById("estimateSize"),
  estimateTime: document.getElementById("estimateTime"),
};

const state = {
  file: null,
  loopCount: 1,
  format: "mp4",
  quality: "hd",
  duration: 0,
  fileSize: 0,
  outputBlob: null,
  outputName: null,
  isProcessing: false,
  abortController: null,
};

const qualityPresets = {
  hd: { label: "HD", width: 1080, fps: 30, bitrate: 7000, gifFps: 15 },
  sd: { label: "SD", width: 720, fps: 30, bitrate: 3500, gifFps: 12 },
  small: { label: "Small", width: 480, fps: 24, bitrate: 1500, gifFps: 10 },
};

const MAX_INPUT_BYTES = 200 * 1024 * 1024;
const MAX_INPUT_DURATION = 5 * 60; // seconds
const MAX_OUTPUT_MP4 = 200 * 1024 * 1024;
const MAX_OUTPUT_GIF = 30 * 1024 * 1024;
const API_BASE = "http://localhost:3000";

function setLoop(value) {
  state.loopCount = Number(value);
  document.querySelectorAll("#loopGroup .pill").forEach((btn) =>
    btn.classList.toggle("pill--active", btn.dataset.value === String(value))
  );
  updateEstimates();
}

function setFormat(value) {
  state.format = value;
  document.querySelectorAll("#formatGroup .pill").forEach((btn) =>
    btn.classList.toggle("pill--active", btn.dataset.value === value)
  );
  updateEstimates();
}

function setQuality(value) {
  state.quality = value;
  updateEstimates();
}

function log(message) {
  ui.logArea.textContent += `${message}\n`;
  ui.logArea.scrollTop = ui.logArea.scrollHeight;
}

function resetUI() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  state.file = null;
  state.duration = 0;
  state.fileSize = 0;
  state.outputBlob = null;
  state.outputName = null;
  state.isProcessing = false;
  ui.fileInput.value = "";
  ui.processBtn.disabled = true;
  ui.downloadBtn.disabled = true;
  ui.progressBar.style.width = "0%";
  ui.progressText.textContent = "0%";
  ui.logArea.textContent = "";
  ui.previewSlot.innerHTML = `<p class="muted" data-i18n="previewPlaceholder">Your preview will appear here</p>`;
  updateEstimates();
}

function humanFile(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let u = 0;
  while (value >= 1024 && u < units.length - 1) {
    value /= 1024;
    u++;
  }
  return `${value.toFixed(1)} ${units[u]}`;
}

function estimate() {
  if (!state.file || !state.duration) return { size: "—", time: "—" };
  const preset = qualityPresets[state.quality];
  const loops = state.loopCount;
  const duration = state.duration * loops;
  if (state.format === "mp4") {
    const kbps = preset.bitrate + 128; // add audio budget
    const bytes = (kbps * 1000 * duration) / 8;
    const seconds = Math.max(10, duration * 0.2); // backend processing is faster
    return { size: humanFile(bytes), time: `${seconds.toFixed(0)}s (rough)` };
  }
  const gifKbps = preset.gifFps * preset.width * 0.6;
  const bytes = (gifKbps * 1000 * duration) / 8;
  const seconds = Math.max(12, duration * 0.5); // GIF encoding
  return { size: humanFile(bytes), time: `${seconds.toFixed(0)}s (rough)` };
}

function updateEstimates() {
  const { size, time } = estimate();
  ui.estimateSize.textContent = `Estimated output size: ${size}`;
  ui.estimateTime.textContent = `Estimated processing time: ${time}`;
}

function validateInput(file, duration) {
  const errors = [];
  if (file.size > MAX_INPUT_BYTES) errors.push("File too large (suggested ≤200MB).");
  if (duration > MAX_INPUT_DURATION) errors.push("Video too long (suggested ≤5 minutes).");
  return errors;
}

function renderPreview(blob, format) {
  ui.previewSlot.innerHTML = "";
  if (format === "mp4" || format === "gif") {
    if (format === "mp4") {
      const video = document.createElement("video");
      video.controls = true;
      video.loop = true;
      video.src = URL.createObjectURL(blob);
      ui.previewSlot.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      ui.previewSlot.appendChild(img);
    }
  }
}

async function readMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };
    video.onerror = () => reject(new Error("Unable to read video metadata"));
    video.src = URL.createObjectURL(file);
  });
}

async function handleFile(file) {
  ui.logArea.textContent = "";
  state.file = file;
  state.fileSize = file.size;
  try {
    state.duration = await readMetadata(file);
  } catch (err) {
    log("Could not read metadata. Proceeding without estimates.");
  }
  const errs = validateInput(file, state.duration);
  if (errs.length) {
    errs.forEach((e) => log(`⚠ ${e}`));
  }
  ui.processBtn.disabled = false;
  updateEstimates();
}

// Process video via backend API
async function processVideo() {
  if (!state.file || state.isProcessing) return;

  state.isProcessing = true;
  ui.processBtn.disabled = true;
  ui.downloadBtn.disabled = true;
  ui.progressBar.style.width = "0%";
  ui.progressText.textContent = "0%";
  ui.logArea.textContent = "";

  state.abortController = new AbortController();

  try {
    log("Uploading video to server...");
    ui.progressBar.style.width = "10%";
    ui.progressText.textContent = "10%";

    // Prepare form data
    const formData = new FormData();
    formData.append("video", state.file);
    formData.append("loopCount", state.loopCount);
    formData.append("format", state.format);
    formData.append("quality", state.quality);

    // Upload and process
    log("Uploading and processing video on server...");
    ui.progressBar.style.width = "20%";
    ui.progressText.textContent = "20%";

    const response = await fetch(`${API_BASE}/api/process`, {
      method: "POST",
      body: formData,
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    // Get the processed file
    log("Downloading processed video...");
    
    // Simulate progress while downloading (since we don't have real progress from server)
    const progressInterval = setInterval(() => {
      const current = parseInt(ui.progressBar.style.width) || 20;
      if (current < 90) {
        const newProgress = Math.min(90, current + 5);
        ui.progressBar.style.width = `${newProgress}%`;
        ui.progressText.textContent = `${newProgress}%`;
      }
    }, 500);

    const blob = await response.blob();
    clearInterval(progressInterval);
    const contentDisposition = response.headers.get("content-disposition");
    let filename = `looped-${Date.now()}.${state.format}`;
    if (contentDisposition) {
      // Handle both quoted and unquoted filenames
      // Format: attachment; filename="looped-xxx.mp4" or attachment; filename=looped-xxx.mp4
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match) {
        filename = match[1].replace(/^["']|["']$/g, ''); // Remove quotes
        // Ensure filename has correct extension
        if (!filename.endsWith(`.${state.format}`)) {
          filename = filename.replace(/\.[^.]+$/, `.${state.format}`);
        }
      }
    }

    state.outputBlob = blob;
    state.outputName = filename;

    // Check output size
    if (state.format === "mp4" && blob.size > MAX_OUTPUT_MP4) {
      log("⚠ Output exceeds suggested 200MB for MP4. Consider lower quality or fewer loops.");
    }
    if (state.format === "gif" && blob.size > MAX_OUTPUT_GIF) {
      log("⚠ Output exceeds suggested 30MB for GIF. Consider lower quality or fewer loops.");
    }

    renderPreview(blob, state.format);
    ui.downloadBtn.disabled = false;
    ui.progressBar.style.width = "100%";
    ui.progressText.textContent = "100%";
    log("Done.");
  } catch (err) {
    if (err.name === "AbortError") {
      log("Processing cancelled.");
    } else {
      log(`Error: ${err.message}`);
      console.error(err);
    }
  } finally {
    state.isProcessing = false;
    state.abortController = null;
    ui.processBtn.disabled = false;
  }
}

function downloadOutput() {
  if (!state.outputBlob || !state.outputName) return;
  const url = URL.createObjectURL(state.outputBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.outputName;
  a.click();
  URL.revokeObjectURL(url);
}

function bindPills(groupEl, callback) {
  groupEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    callback(btn.dataset.value);
  });
}

function setupDrop() {
  const accept = ["video/mp4", "video/webm", "video/quicktime"];
  ["dragenter", "dragover"].forEach((evt) =>
    ui.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.dropzone.classList.add("dropzone--hover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    ui.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      ui.dropzone.classList.remove("dropzone--hover");
    })
  );
  ui.dropzone.addEventListener("drop", async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && accept.includes(file.type)) {
      await handleFile(file);
    } else {
      log("Unsupported file type. Please use MP4/H.264, MOV/H.264, or WEBM/VP9.");
    }
  });
  ui.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  });
}

function setupActions() {
  bindPills(ui.loopGroup, setLoop);
  bindPills(ui.formatGroup, setFormat);
  ui.qualitySelect.addEventListener("change", (e) => setQuality(e.target.value));
  ui.processBtn.addEventListener("click", processVideo);
  ui.resetBtn.addEventListener("click", resetUI);
  ui.downloadBtn.addEventListener("click", downloadOutput);
  ui.primaryStart.addEventListener("click", () => ui.fileInput.click());
  ui.secondaryLearn.addEventListener("click", () => {
    document.getElementById("legalSection")?.scrollIntoView({ behavior: "smooth" });
  });
}

async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    if (data.status === "ok") {
      log("✓ Server connected. Ready to process videos.");
      return true;
    }
  } catch (err) {
    log("⚠ Cannot connect to server. Make sure the backend is running.");
    log(`   Error: ${err.message}`);
    ui.processBtn.disabled = true;
    return false;
  }
}

function init() {
  resetUI();
  setupDrop();
  setupActions();
  checkServerHealth();
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
