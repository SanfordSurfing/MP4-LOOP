# 快速启动指南

## 第一次使用

### 1. 安装 Node.js 依赖

```bash
npm install
```

这会安装以下包：
- `express` - Web 服务器框架
- `multer` - 文件上传处理
- `fluent-ffmpeg` - FFmpeg 的 Node.js 封装
- `cors` - 跨域支持

### 2. 安装 FFmpeg（如果还没安装）

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
# 或
sudo yum install ffmpeg
```

**Windows:**
从 https://ffmpeg.org/download.html 下载并添加到系统 PATH

验证安装：
```bash
ffmpeg -version
```

### 3. 启动服务器

```bash
npm start
```

你会看到：
```
Server running at http://localhost:3000
Make sure FFmpeg is installed on your system
```

### 4. 打开浏览器

访问：`http://localhost:3000`

## 日常使用

每次使用只需要：

```bash
npm start
```

然后打开浏览器访问 `http://localhost:3000` 即可。

## 停止服务器

在终端按 `Ctrl + C` 停止服务器。

