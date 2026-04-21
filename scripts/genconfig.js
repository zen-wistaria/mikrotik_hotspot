import path from 'node:path';
import { createInterface } from 'node:readline';
import fs from 'fs-extra';

const DEFAULT_CONFIG = {
  alogin: {
    meta: {
      title: 'Wi.Fi | Redirecting',
      description:
        'Authentication required. Sending you to the login portal...',
    },
  },
  error: {
    meta: {
      title: 'Wi.Fi | Error',
      description: 'An error occurred during authentication. Please try again.',
    },
  },
  flogin: {
    meta: {
      title: 'Wi.Fi | Login Error',
      description: 'Please login to use internet',
    },
  },
  flogout: {
    meta: {
      title: 'Wi.Fi | Session Inactive',
      description: 'Your session has expired. Please login again.',
    },
  },
  fstatus: {
    meta: {
      title: 'Wi.Fi | Authentication Required',
      description: 'Please login to use internet',
    },
  },
  login: {
    meta: {
      title: 'Wi.Fi | Login',
      description: 'Please login to use internet',
    },
    title: 'Wi.Fi Portal',
    description: 'Select your connection protocol',
  },
  logout: {
    meta: {
      title: 'Wi.Fi | Logged Out',
      description: 'You have been logged out of the network.',
    },
  },
  radvert: {
    meta: {
      title: 'Wi.Fi | Advertisement',
      description: 'Advertisement',
    },
  },
  rlogin: {
    meta: {
      title: 'Wi.Fi | Redirecting',
      description:
        'Authentication required. Sending you to the login portal...',
    },
  },
  rstatus: {
    meta: {
      title: 'Wi.Fi | Session Active',
      description: 'Your session is active. You are connected to the network.',
    },
  },
  status: {
    meta: {
      title: 'Wi.Fi | Status',
      description: 'Your connection status and session details.',
    },
  },
  trials: {
    meta: {
      title: 'Wi.Fi | Trials',
      description: 'Please login to use internet',
    },
  },
  footer: 'Powered by Zen — v2.0.0',
};

const SRC_DIR = path.join(process.cwd());
const CONFIG_PATH = path.join(SRC_DIR, 'config.json');

async function generateConfig() {
  // Check if config.json already exists
  if (await fs.pathExists(CONFIG_PATH)) {
    console.log('⚠️  config.json already exists.');
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((resolve) => {
      readline.question('Overwrite? (y/N): ', resolve);
    });
    readline.close();
    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Generation cancelled.');
      process.exit(0);
    }
  }

  // Tulis config.json dengan format JSON yang rapi
  await fs.writeJson(CONFIG_PATH, DEFAULT_CONFIG, { spaces: 2 });
  console.log('✅ Generated config.json with default settings.');
  console.log('📝 Edit config.json to customize your hotspot.');
}

generateConfig().catch((err) => {
  console.error('❌ Failed to generate config:', err);
  process.exit(1);
});
