const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const parsedEnv = {};

const candidatePaths = [
  process.env.DOTENV_PATH,
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env')
].filter(Boolean);

let loadedPath = null;

for (const candidatePath of candidatePaths) {
  if (fs.existsSync(candidatePath)) {
    const fileContents = fs.readFileSync(candidatePath);
    const parsed = dotenv.parse(fileContents);

    for (const [key, value] of Object.entries(parsed)) {
      parsedEnv[key] = value;
      process.env[key] = value;
    }

    loadedPath = candidatePath;
    break;
  }
}

if (!loadedPath) {
  const result = dotenv.config({ override: true });
  if (result.parsed) {
    Object.assign(parsedEnv, result.parsed);
  }
}

function getEnv(name, fallback = undefined) {
  const runtimeValue = process.env[name];
  if (typeof runtimeValue === 'string' && runtimeValue.trim() !== '') {
    return runtimeValue;
  }

  const fileValue = parsedEnv[name];
  if (typeof fileValue === 'string' && fileValue.trim() !== '') {
    return fileValue;
  }

  return fallback;
}

module.exports = { loadedPath, parsedEnv, getEnv };