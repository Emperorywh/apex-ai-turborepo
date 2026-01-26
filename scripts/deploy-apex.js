const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_NAME = 'apex-ai';
const APP_DIR = path.join(ROOT_DIR, 'apps', APP_NAME);
const DIST_ROOT = path.join(ROOT_DIR, 'dist');
const DIST_DIR = path.join(DIST_ROOT, APP_NAME);

console.log(`\n🚀 Starting deployment generation for ${APP_NAME}...\n`);

// 1. Build
console.log('📦 Building project...');
try {
  execSync(`pnpm --filter ${APP_NAME} build`, { stdio: 'inherit', cwd: ROOT_DIR });
} catch (e) {
  console.error('❌ Build failed.');
  process.exit(1);
}

// 2. Prepare Dist Directory
console.log(`\n📂 Preparing deployment folder: ${DIST_DIR}`);
if (!fs.existsSync(DIST_ROOT)) {
    fs.mkdirSync(DIST_ROOT);
}
if (fs.existsSync(DIST_DIR)) {
  console.log('   Cleaning existing folder...');
  try {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.mkdirSync(DIST_DIR);
  } catch (e) {
    console.warn('   ⚠️ Could not delete existing folder (likely busy). Attempting to overwrite...');
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR);
  }
} else {
  fs.mkdirSync(DIST_DIR);
}

// 3. Copy Standalone Output (Excluding node_modules to avoid cross-platform issues)
const standaloneDir = path.join(APP_DIR, '.next', 'standalone');
if (!fs.existsSync(standaloneDir)) {
  console.error(`❌ Error: Standalone directory not found at ${standaloneDir}`);
  process.exit(1);
}

console.log('📋 Copying standalone build (skipping node_modules)...');
// We copy everything EXCEPT node_modules
// Because node_modules contains symlinks and platform-specific binaries that break on Linux
fs.cpSync(standaloneDir, DIST_DIR, { 
    recursive: true, 
    filter: (src) => !src.includes('node_modules') 
});

// 4. Copy Static Assets
const targetAppDir = path.join(DIST_DIR, 'apps', APP_NAME);
if (!fs.existsSync(targetAppDir)) {
    // If structure is flattened
    if (fs.existsSync(path.join(DIST_DIR, 'server.js'))) {
        // Handle flattened structure if necessary, but typically it's nested
    } else {
        console.warn(`⚠️ Warning: Expected path ${targetAppDir} not found. Structure might vary.`);
    }
}

console.log('📋 Copying static assets...');
const publicDir = path.join(APP_DIR, 'public');
const targetPublicDir = path.join(targetAppDir, 'public');
if (fs.existsSync(publicDir)) {
    console.log(`   Copying public -> ${targetPublicDir}`);
    fs.cpSync(publicDir, targetPublicDir, { recursive: true });
}

const staticDir = path.join(APP_DIR, '.next', 'static');
const targetStaticDir = path.join(targetAppDir, '.next', 'static');
console.log(`   Copying .next/static -> ${targetStaticDir}`);
fs.mkdirSync(path.dirname(targetStaticDir), { recursive: true });
if (fs.existsSync(staticDir)) {
    fs.cpSync(staticDir, targetStaticDir, { recursive: true });
}

// 5. Generate package.json for Production
console.log('📝 Generating production package.json...');
const originalPackageJson = require(path.join(APP_DIR, 'package.json'));
const prodDependencies = {};

// Filter out workspace dependencies and add necessary production deps
if (originalPackageJson.dependencies) {
    Object.entries(originalPackageJson.dependencies).forEach(([key, value]) => {
        if (!value.startsWith('workspace:')) {
            prodDependencies[key] = value;
        }
    });
}

// Explicitly add critical dependencies that might be missing or peer-deps
// 'sharp' is needed for Image Optimization on Linux
// 'styled-jsx' was reported missing
prodDependencies['sharp'] = 'latest';
prodDependencies['styled-jsx'] = 'latest'; 
// Ensure next is present (it should be in dependencies, but just in case)
if (!prodDependencies['next']) prodDependencies['next'] = 'latest';

const prodPackageJson = {
    name: `${APP_NAME}-deploy`,
    version: originalPackageJson.version,
    private: true,
    scripts: {
        "start": "node start.js",
        "postinstall": "echo 'Dependencies installed. Ready to start.'"
    },
    dependencies: prodDependencies,
    engines: originalPackageJson.engines
};

fs.writeFileSync(
    path.join(DIST_DIR, 'package.json'), 
    JSON.stringify(prodPackageJson, null, 2)
);

// 6. Create Ecosystem File & Entry Point
console.log('📝 Generating ecosystem.config.js...');
// Use dynamic path resolution to ensure CWD is correct regardless of where PM2 starts
const ecosystemContent = `const path = require('path');

module.exports = {
  apps: [{
    name: "${APP_NAME}",
    cwd: path.join(__dirname, 'apps/${APP_NAME}'),
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      HOSTNAME: "0.0.0.0"
    }
  }]
};
`;
fs.writeFileSync(path.join(DIST_DIR, 'ecosystem.config.js'), ecosystemContent);

// Also create a simple start.js for non-PM2 or simple usage
console.log('📝 Generating simple start.js entry point...');
const startContent = `
const path = require('path');

// Set default environment variables
process.env.NODE_ENV = 'production';
if (!process.env.PORT) process.env.PORT = '3000';
if (!process.env.HOSTNAME) process.env.HOSTNAME = '0.0.0.0';

const appDir = path.join(__dirname, 'apps', '${APP_NAME}');

console.log('--------------------------------------------------');
console.log('🚀 Apex AI Startup Script');
console.log('--------------------------------------------------');
console.log('📂 Original CWD:', process.cwd());
console.log('📂 Target App Dir:', appDir);
console.log('🌍 Environment:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   HOSTNAME:', process.env.HOSTNAME);

// 1. Force change working directory to the app folder
// This ensures Next.js finds .next and public folders correctly
try {
    if (process.cwd() !== appDir) {
        process.chdir(appDir);
        console.log('✅ Changed CWD to:', process.cwd());
    }
} catch (err) {
    console.error('❌ Failed to change directory:', err);
    process.exit(1);
}

// 2. Start the server
console.log('⚡ Starting server.js...');
console.log('--------------------------------------------------');

try {
    // Use absolute path to require server.js to avoid relative path confusion
    // We use require() so it runs in the same process
    require(path.join(appDir, 'server.js'));
} catch (err) {
    console.error('❌ Error requiring server.js:', err);
    process.exit(1);
}
`;
fs.writeFileSync(path.join(DIST_DIR, 'start.js'), startContent);

// 7. Create README
const readmeContent = `
# Deployment Instructions

1. Upload all files in this folder to your server (e.g., /www/wwwroot/apex-ai).
2. Enter the directory and install dependencies:
   
   npm install --omit=dev

   (This ensures platform-specific binaries like 'sharp' are correct for Linux)

3. Start the application using PM2:

   Option A (Recommended): Use Ecosystem file
   pm2 start ecosystem.config.js

   Option B (Alternative): Use start.js (works well with panels like Baota/Pagoda)
   node start.js
   (Or select 'start.js' as the startup file in your panel)

   OR directly:

   node apps/apex-ai/server.js

Note: This folder was generated for Linux deployment. Do not run it on Windows without reinstalling dependencies.

-------------------------------------------------------------------------------
Troubleshooting "Typewriter Effect" / Streaming Issues
-------------------------------------------------------------------------------
If you find that the AI response comes all at once instead of streaming (typewriter effect),
it is likely due to Nginx buffering.

1. Ensure the application code sends 'X-Accel-Buffering: no' header (already included in this build).
2. If that doesn't work, add the following to your Nginx configuration in Baota/Pagoda Panel:

   location /api/ {
       proxy_pass http://127.0.0.1:3000;
       proxy_buffering off;
       proxy_cache off;
       chunked_transfer_encoding on;
   }

   Or globally in the server block:
   proxy_buffering off;
`;
fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readmeContent);

console.log(`\n✅ Deployment folder created successfully at: ${DIST_DIR}`);
console.log(`\n⚠️  IMPORTANT:`);
console.log(`   Since this is a cross-platform deployment (Windows -> Linux), node_modules were NOT copied.`);
console.log(`   You MUST run 'npm install --omit=dev' on the server after uploading.`);
console.log(`   See ${path.join(DIST_DIR, 'README.txt')} for details.\n`);

// 8. Self-test
console.log('\n🧪 Starting self-test...');
const testDir = path.join(DIST_ROOT, `${APP_NAME}-test`);

// Clean previous test dir
if (fs.existsSync(testDir)) {
    try {
        fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
        console.warn('   ⚠️ Could not clean previous test directory. Retrying...');
    }
}

// Copy dist to test dir
console.log('   Copying to temporary test directory...');
try {
    fs.cpSync(DIST_DIR, testDir, { recursive: true });
} catch (e) {
    console.error('❌ Failed to prepare test directory:', e.message);
    process.exit(1);
}

// Install dependencies
console.log('   Installing production dependencies (this may take a moment)...');
try {
    execSync('npm install --omit=dev --no-audit --no-fund', { cwd: testDir, stdio: 'inherit' });
} catch (e) {
    console.error('❌ Failed to install dependencies for test.');
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
    process.exit(1);
}

// Start server
console.log('   Starting server for verification...');
const port = 3001;
const server = spawn('node', ['server.js'], {
    cwd: path.join(testDir, 'apps', APP_NAME),
    env: { ...process.env, PORT: port.toString(), NODE_ENV: 'production', HOSTNAME: '127.0.0.1' },
    stdio: 'pipe'
});

let verified = false;
let serverOutput = '';

const timeout = setTimeout(() => {
    if (!verified) {
        console.error('❌ Timeout waiting for server to start.');
        console.error('Server Output:', serverOutput);
        cleanup();
        process.exit(1);
    }
}, 60000); // 60s timeout

server.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    if (output.includes('Listening') || output.includes('Ready in') || output.includes('started server on')) {
        console.log('   ✅ Server process is running...');
        // We still wait for HTTP check to be sure
    }
});

server.stderr.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    // Some deprecation warnings go to stderr, so we don't fail immediately, but log it
    // console.error('[Server Error]', output); 
});

server.on('close', (code) => {
    if (!verified) {
        console.error(`❌ Server exited prematurely with code ${code}`);
        console.error('Server Output:', serverOutput);
        cleanup();
        process.exit(1);
    }
});

// Check with HTTP request
const checkInterval = setInterval(() => {
    if (verified) return;
    
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
            console.log(`✅ HTTP Health check passed! (Status: ${res.statusCode})`);
            verified = true;
            cleanup();
        }
    });
    
    req.on('error', (err) => {
        // console.log('   Waiting for server...', err.message);
    });
    
}, 2000);

function cleanup() {
    clearTimeout(timeout);
    clearInterval(checkInterval);
    if (server) server.kill();
    
    console.log('   Cleaning up test directory...');
    // Give process time to exit and release file locks
    setTimeout(() => {
        try {
             fs.rmSync(testDir, { recursive: true, force: true });
             console.log('\n✨ Deployment package is ready and verified!');
             console.log(`📁 Final Output: ${DIST_DIR}`);
        } catch(e) {
            console.warn(`   ⚠️ Could not remove test directory automatically (likely Windows file locking).`);
            console.warn(`   You can delete it manually: ${testDir}`);
            console.log('\n✨ Deployment package is ready and verified!');
            console.log(`📁 Final Output: ${DIST_DIR}`);
        }
    }, 3000);
}
