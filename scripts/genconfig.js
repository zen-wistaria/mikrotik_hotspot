import path from 'node:path';
import { createInterface } from 'node:readline';
import fs from 'fs-extra';

const DEFAULT_CONFIG = {
  simple: true,
  price: false,
  price_lists: [
    {
      title: '1 Jam',
      price: 'Rp. 1000',
    },
    {
      title: '1 Hari',
      price: 'Rp. 2000',
    },
    {
      title: '1 Minggu',
      price: 'Rp. 5000',
    },
  ],
  errors_lang: 'en',
  qrcode: {
    meta: {
      title: 'Wi.Fi | QR Code Scanner',
      description: 'Scan QR codes to log in to hotspot',
    },
    title: 'QR Code Scanner',
    description:
      'Point the QR code to the camera area • Auto redirect for links',
    button: {
      switchCam: 'Switch Camera',
      startCam: 'Start Camera',
      stopCam: 'Stop Camera',
    },
    text: {
      scanFromFile: 'Drag/Upload QR Code voucher from file/image',
    },
    notifications: {
      qrInvalid: 'QR code is empty or invalid',
      qrSuccess: 'Valid QR Code! Authenticating...',
      qrNotFound: 'QR code not found',
      camStart: 'Camera is active...',
      camAlreadyActive: 'Camera is already active',
      camInitFailed: 'Click Start to activate the camera',
      camStop: 'Camera stopped',
      camFailed: 'Failed to access camera',
      camInvalid: 'Camera is not active, please start it first',
      camNotAvailable: 'No other camera available',
      camSwitching: 'Switching camera',
      camSwitchingFailed: 'Failed to switch camera',
    },
    footer: '✦ Auto QR • Automatically logs in after scan ✦',
  },
  alogin: {
    meta: {
      title: 'Wi.Fi | Redirecting',
      description:
        'Authentication required. Sending you to the login portal...',
    },
    title: 'Access Granted',
    description: 'Authentication successful. Initializing secure tunnel...',
  },
  error: {
    meta: {
      title: 'Wi.Fi | Error',
      description: 'An error occurred during authentication. Please try again.',
    },
    title: 'System Error',
    description: 'The authentication protocol has encountered an anomaly.',
    button: 'Go to Login Page',
  },
  flogin: {
    meta: {
      title: 'Wi.Fi | Login Error',
      description: 'Please login to use internet',
    },
    title: 'Login Error',
    description: 'Something went wrong with your authentication request.',
    button: 'Return Authentication',
  },
  flogout: {
    meta: {
      title: 'Wi.Fi | No Active Session',
      description: 'No active session was found for your device.',
    },
    title: 'Disconnected',
    description: 'No active session was found for your device.',
    message:
      'The logout request was ignored because you are already disconnected or were never logged in.',
    button: 'Enter Login Page',
  },
  fstatus: {
    meta: {
      title: 'Wi.Fi | Authentication Required',
      description: 'Please login to use internet',
    },
    title: 'Authentication Required',
    description: 'Access to this page is restricted for unauthenticated users.',
    message:
      'Please sign in to view your current connection status and session details.',
    button: 'Go to Login Page',
  },
  login: {
    meta: {
      title: 'Wi.Fi | Login',
      description: 'Please login to use internet',
    },
    title: 'Wi.Fi Portal',
    description: 'Select your connection protocol',
    buttonTrial: 'Gratisan',
    buttonAuth: 'Authenticate',
    buttonConnect: 'Connect',
    buttonScan: 'Scan QR Code',
    buttonPrice: 'Price List',
  },
  logout: {
    meta: {
      title: 'Wi.Fi | Logged Out',
      description: 'You have been logged out of the network.',
    },
    title: 'Session Closed',
    description: 'You have been logged out of the network.',
    footer: 'Secure Logout Protocol Completed',
    button: 'Return to Login',
  },
  radvert: {
    meta: {
      title: 'Wi.Fi | Advertisement',
      description: 'Advertisement',
    },
    title: 'Sponsored Access',
    description: 'Authentication redirected. Opening advertisement...',
    button: 'Continue to Destination',
  },
  rlogin: {
    meta: {
      title: 'Wi.Fi | Redirecting',
      description:
        'Authentication required. Sending you to the login portal...',
    },
    title: 'Redirecting',
    description: 'Authentication required. Sending you to the login portal...',
  },
  rstatus: {
    meta: {
      title: 'Wi.Fi | Session Active',
      description: 'Your session is active. You are connected to the network.',
    },
    title: 'Session Active',
    description:
      'You are already authenticated. Redirecting to your destination...',
  },
  status: {
    meta: {
      title: 'Wi.Fi | Status',
      description: 'Your connection status and session details.',
    },
    title: 'Session Active',
    description: 'Welcome back, you are already authenticated.',
    footer: 'Session Live & Secured',
    button: 'Terminate Session',
  },
  trials: {
    meta: {
      title: 'Wi.Fi | Trials',
      description: 'Please login to use internet',
    },
    title: 'Please Wait',
    description:
      'Please wait a moment while we establish your secure connection.',
    message:
      "Selamat menikmati internet gratis. <br> jangan lupa do'akan yang punya wifi agar banyak rezeki nya. <br> Aaamminnnn.. 🤲",
    footer: 'Your session will begin automatically after the countdown.',
    button: 'Go to Internet',
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

  await fs.writeJson(CONFIG_PATH, DEFAULT_CONFIG, { spaces: 2 });
  console.log('✅ Generated config.json with default settings.');
  console.log('📝 Edit config.json to customize your hotspot.');
}

generateConfig().catch((err) => {
  console.error('❌ Failed to generate config:', err);
  process.exit(1);
});
