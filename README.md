# ☕ JavaBot

An AI-powered Java programming assistant built with Groq API (LLaMA 3.3).

## Features
- 💬 Java-only AI chat with conversation history
- 📎 Upload images, PDFs, DOCX, and code files
- 🎨 Dark/Light theme with accent color customization
- 👤 Firebase authentication (Email + Google)
- ✏️ Edit and reload messages
- 📋 One-click code copy

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js (no Express)
- AI: Groq API — LLaMA 3.3 70B & LLaMA 4 Scout
- Auth & DB: Firebase Auth + Firestore

## Local Setup

1. Clone the repo:
```bash
   git clone https://github.com/yourusername/JavaBot.git
   cd JavaBot
```

2. Install dependencies:
```bash
   npm install
```

3. Create a `.env` file:

4. Run the server:
```bash
   node server.js
```

5. Open browser → `http://localhost:3000`

## Deployment
- Frontend: GitHub Pages
- Backend: Render.com
- Set `GROQ_API_KEY` in Render environment variables

## License
MIT