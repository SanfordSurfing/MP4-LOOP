const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(__dirname));

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

// Quality presets
const qualityPresets = {
  hd: { width: 1080, fps: 30, bitrate: "7000k", gifFps: 15 },
  sd: { width: 720, fps: 30, bitrate: "3500k", gifFps: 12 },
  small: { width: 480, fps: 24, bitrate: "1500k", gifFps: 10 },
};

// Ensure uploads and temp directories exist
const ensureDirs = () => {
  ["uploads", "temp"].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};
ensureDirs();

// Cleanup function for temp files
const cleanup = (files) => {
  files.forEach((file) => {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.error(`Failed to delete ${file}:`, err);
      }
    }
  });
};

// Process video endpoint
app.post("/api/process", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file provided" });
  }

  const { loopCount, format, quality } = req.body;
  const inputPath = req.file.path;
  const preset = qualityPresets[quality] || qualityPresets.hd;
  const loops = parseInt(loopCount) || 1;
  const outputFormat = format === "gif" ? "gif" : "mp4";

  const timestamp = Date.now();
  const outputPath = path.join("temp", `output-${timestamp}.${outputFormat}`);

  try {
    if (outputFormat === "mp4") {
      // Process MP4: loop video with quality settings
      // loops is extra loop count, so stream_loop should be loops (not loops-1)
      // stream_loop 1 = play original + 1 loop = 2 total plays
      await new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .inputOptions(["-stream_loop", String(loops)]) // Loop the input
          .videoFilters([
            `scale='min(${preset.width},iw)':-2:flags=lanczos`,
            `fps=${preset.fps}`,
          ])
          .videoCodec("libx264")
          .videoBitrate(preset.bitrate)
          .audioCodec("aac")
          .audioBitrate("128k")
          .outputOptions([
            "-preset medium",
            "-pix_fmt yuv420p",
            "-movflags +faststart",
          ])
          .output(outputPath)
          .on("start", (cmdline) => {
            console.log("FFmpeg started:", cmdline);
          })
          .on("progress", (progress) => {
            console.log("Processing:", progress.percent || 0, "%");
          })
          .on("end", () => {
            console.log("FFmpeg finished");
            resolve();
          })
          .on("error", (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
          })
          .run();
      });
    } else {
      // Process GIF: two-pass encoding with palette
      const palettePath = path.join("temp", `palette-${timestamp}.png`);

      // First pass: generate palette (with looping)
      // loops is extra loop count, so stream_loop should be loops (not loops-1)
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(["-stream_loop", String(loops)])
          .videoFilters([
            `fps=${preset.gifFps}`,
            `scale='min(${preset.width},iw)':-1:flags=lanczos`,
            "palettegen",
          ])
          .output(palettePath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      // Second pass: create GIF with palette (with looping)
      // loops is extra loop count, so stream_loop should be loops (not loops-1)
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions(["-stream_loop", String(loops)])
          .input(palettePath)
          .complexFilter([
            `fps=${preset.gifFps},scale='min(${preset.width},iw)':-1:flags=lanczos[x]`,
            `[x][1:v]paletteuse`,
          ])
          .outputOptions(["-loop", "0"])
          .output(outputPath)
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      // Cleanup palette
      cleanup([palettePath]);
    }

    // Send the processed file with correct content type and filename
    const filename = `looped-${timestamp}.${outputFormat}`;
    res.setHeader("Content-Type", outputFormat === "gif" ? "image/gif" : "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    fileStream.on("end", () => {
      // Cleanup after sending
      cleanup([inputPath, outputPath]);
    });
    
    fileStream.on("error", (err) => {
      console.error("Stream error:", err);
      cleanup([inputPath, outputPath]);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error sending file" });
      }
    });
  } catch (error) {
    console.error("Processing error:", error);
    cleanup([inputPath, outputPath]);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Make sure FFmpeg is installed on your system");
});

