# SEO Video Compressor - Video Loop Maker

纯前端网站，用户上传视频后生成循环播放版本（示例：输入帧序列 1 2 3 4 5，可输出 1 2 3 4 5 1 2 3 4 5 1 2 3 4 5，循环次数仅提供预设 1/3/5），输出格式 MP4 或 GIF。

## 技术栈

- **前端**：HTML + CSS + JavaScript（纯静态页面）
- **后端**：Node.js + Express + FFmpeg（处理视频循环）
- **优势**：后端使用 FFmpeg，完全避免 CORS 问题

## 快速开始

### 1. 安装依赖

```bash
# 确保已安装 Node.js (v14+)
node --version

# 安装项目依赖
npm install
```

### 2. 安装 FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
下载 FFmpeg 并添加到 PATH: https://ffmpeg.org/download.html

### 3. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

### 4. 使用

1. 打开浏览器访问 `http://localhost:3000`
2. 上传视频文件（MP4/MOV/WEBM）
3. 选择循环次数（1/3/5）
4. 选择质量预设（HD/SD/Small）
5. 选择输出格式（MP4/GIF）
6. 点击 Process 开始处理
7. 处理完成后下载结果

## 项目结构

- `index.html` - 前端页面
- `app.js` - 前端逻辑（调用后端 API）
- `styles.css` - 样式文件
- `server.js` - 后端服务器（Express + FFmpeg）
- `package.json` - Node.js 依赖配置
- `vendor/` - 本地库文件（gif.js，已不再使用）

## 功能特性

- ✅ 视频循环处理（1/3/5 次）
- ✅ 输出 MP4 或 GIF 格式
- ✅ 质量预设（HD/SD/Small）
- ✅ 响应式设计（移动端和 PC 端）
- ✅ Apple 风格 UI
- ✅ 拖拽上传
- ✅ 进度显示
- ✅ 预览和下载

## 限制

- 输入：≤200MB · ≤5 分钟 · ≤1080p · ≤60fps
- 输出：MP4 ≤200MB，GIF ≤30MB

## 开发说明

- 前端代码在 `app.js` 中，通过 `fetch` API 调用后端
- 后端代码在 `server.js` 中，使用 `fluent-ffmpeg` 处理视频
- 上传的文件存储在 `uploads/` 目录（临时）
- 处理后的文件存储在 `temp/` 目录（临时）
- 文件在处理完成后会自动清理

## 更新历史

- 2025-12-10 初始化项目，需求确认
- 2025-12-13 重构为后端架构，使用 Node.js + Express + FFmpeg
