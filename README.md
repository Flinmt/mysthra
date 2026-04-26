# <p align="center"><img src="client/public/favicon.png" width="80" height="80" alt="Mysthra Logo" /><br/>Mysthra</p>

<p align="center">
  <strong>The Ultimate Self-Hosted Worldbuilding Forge</strong><br/>
  <em>A professional, minimalist, and high-fidelity platform for creators, writers, and world-builders.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-purple?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-Polyform--Noncommercial-red?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Open--Source-Yes-green?style=for-the-badge" alt="Open Source" />
</p>

---

## 🌌 What is Mysthra?

**Mysthra** is an open-source, self-hosted workspace designed specifically for world-building. It combines the simplicity of **Markdown** with the limitless flexibility of **HTML/CSS**, allowing you to forge immersive lore, detailed maps, and complex character databases with a premium, focused interface.

Unlike general-purpose note apps, Mysthra is built for **atmosphere**. Every pixel of the "Nexus" dashboard and the editor was designed to keep you in the creative flow.

---

## ✨ Key Features

### 🏰 The Nexus Dashboard
Your gateway to all your universes. A high-fidelity, horizontal gallery that presents your worlds as cinematic posters. Minimalist, clean, and blazingly fast.

### ✍️ Pro Writing Workspace
- **Monaco-Powered Editor**: The same engine that powers VS Code, now optimized for world-building.
- **Live Hybrid Preview**: See your Markdown and HTML come to life instantly with a high-fidelity rendering engine.
- **Intelligent Autosave**: Never lose a single word. Mysthra saves your progress every 2 seconds in the background and supports `Ctrl + S`.
- **Media Management**: Drag and drop support for images and audio, automatically converted into clean HTML tags for total control over your layout.

### 🛠️ Total Customization
- **HTML & CSS First**: Use standard web technologies to create custom layouts, embedded music players, or interactive lore pieces.
- **Template System**: Save your best structures (stat blocks, locations, timelines) as templates and reuse them across any file.
- **Wiki-style Linking**: Connect your ideas with easy internal linking (`[[page-name]]`).

---

## 🚀 Getting Started

Mysthra is designed to be **Self-Hosted**. You own your data.

### Prerequisites
- **Node.js 20.x** or higher
- **FFmpeg** (for media processing)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/mysthra.git
   cd mysthra
   ```

2. **Install dependencies**:
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   ```

4. **Run the forge**:
   ```bash
   # From the root directory
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🎨 Design Philosophy

Mysthra follows the **Nexus Aesthetic**:
- **Glassmorphism**: Deep blurs and frosted glass panels for a modern, tactile feel.
- **Dark-First**: Optimized for long creative sessions without eye strain.
- **Zero Scroll Navigation**: The core interface stays fixed while your content flows, providing a stable "station" for creation.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://reactjs.org/), [Vite](https://vitejs.dev/), [Lucide Icons](https://lucide.dev/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Backend**: [Node.js](https://nodejs.org/)
- **Media Processing**: [Sharp](https://sharp.pixelplumbing.com/), [FFmpeg](https://www.ffmpeg.org/)

---

## 🤝 Contributing

Mysthra is an **open-source** project and we love contributions! 
Whether it's a bug fix, a new feature, or CSS themes, feel free to open a Pull Request.

---

## 📜 License

Distributed under the **Polyform Noncommercial License 1.0.0**. This project is free to use and modify for personal and non-commercial purposes. **Commercial use or profiting from the platform is strictly prohibited.** See `LICENSE` for more information.

<p align="center">
  <em>Forged with ❤️ by the little old me.</em>
</p>
