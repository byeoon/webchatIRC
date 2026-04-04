#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { createServer } = require('../index.js');

const configName = 'webchat.config.json';
const configPath = path.join(process.cwd(), configName);

let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`[webchatIRC] Loaded config from ${configPath}`);
} catch (err) {
    console.log(`[webchatIRC] No ${configName} found in current directory, using defaults.`);
}

createServer(config);
