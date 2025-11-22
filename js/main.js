/**
 * Zork I Web Terminal
 * Connects ifvms.js Z-machine interpreter to CRT terminal UI
 */

// Import CSS through Vite's build system
import '../css/terminal.css';

import { createGlk } from './glk-adapter.js';

class ZorkTerminal {
  constructor() {
    this.vm = null;
    this.outputEl = document.getElementById('output');
    this.inputEl = document.getElementById('input');
    this.crtEl = document.querySelector('.crt');
    this.commandHistory = [];
    this.historyIndex = -1;
    this.inputResolver = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle command submission
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });

    // Keep input focused
    document.addEventListener('click', () => {
      this.inputEl.focus();
    });
  }

  navigateHistory(direction) {
    if (this.commandHistory.length === 0) return;

    this.historyIndex += direction;

    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      this.inputEl.value = '';
      return;
    }

    this.inputEl.value = this.commandHistory[this.historyIndex];
  }

  // Terminal interface methods called by Glk adapter
  print(text) {
    if (!text) return;

    // Split by newlines and append each line
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0 || line) {
        const div = document.createElement('div');
        div.textContent = line || '\u00A0'; // Non-breaking space for empty lines
        this.outputEl.appendChild(div);
      }
    });

    this.scrollToBottom();
  }

  clear() {
    this.outputEl.innerHTML = '';
  }

  handleError(message) {
    const div = document.createElement('div');
    div.className = 'status';
    div.textContent = `Error: ${message}`;
    this.outputEl.appendChild(div);
    this.scrollToBottom();
  }

  waitForInput(callback) {
    this.inputResolver = callback;
    this.inputEl.disabled = false;
    this.inputEl.focus();
  }

  scrollToBottom() {
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  handleCommand() {
    const command = this.inputEl.value;
    this.inputEl.value = '';

    if (command.trim()) {
      // Add to history
      this.commandHistory.push(command);
      this.historyIndex = this.commandHistory.length;
    }

    // Echo the command
    const echo = document.createElement('div');
    echo.className = 'command-echo';
    echo.textContent = `> ${command}`;
    this.outputEl.appendChild(echo);
    this.scrollToBottom();

    // Disable input until VM is ready for more
    this.inputEl.disabled = true;

    // Call the pending input resolver
    if (this.inputResolver) {
      const resolver = this.inputResolver;
      this.inputResolver = null;
      resolver(command);

      // Resume the VM
      if (this.vm && !this.vm.quit) {
        try {
          this.vm.resume(command.length);
        } catch (e) {
          console.error('VM resume error:', e);
          this.handleError(e.message);
        }
      }
    }
  }

  async loadGame(url) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status loading';
    statusDiv.textContent = 'Loading Zork I...';
    this.outputEl.appendChild(statusDiv);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const gameData = new Uint8Array(arrayBuffer);

      // Clear loading message
      this.outputEl.innerHTML = '';

      // Power-on effect
      this.crtEl.classList.add('power-on');

      // Create Glk interface bound to this terminal
      const Glk = createGlk(this);

      // Dynamically import ifvms (it uses CommonJS)
      const { ZVM } = await import('ifvms');

      // Initialize the Z-machine
      this.vm = new ZVM();
      this.vm.prepare(gameData, { Glk });

      // Start the game
      this.vm.start();

    } catch (error) {
      this.outputEl.innerHTML = '';
      this.handleError(error.message);
      console.error('Failed to load game:', error);
    }
  }
}

// About Modal functionality
function initAboutModal() {
  const aboutBtn = document.getElementById('about-btn');
  const modal = document.getElementById('about-modal');
  const closeBtn = document.getElementById('modal-close');

  if (!aboutBtn || !modal || !closeBtn) return;

  // Open modal
  aboutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.add('active');
  });

  // Close modal with X button
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const terminal = new ZorkTerminal();
  // Use Vite's base URL for correct path in production
  terminal.loadGame(import.meta.env.BASE_URL + 'zork1.z3');

  // Initialize about modal
  initAboutModal();
});
