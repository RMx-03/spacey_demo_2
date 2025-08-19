// Simple smoke test for Spacey Tutor server endpoints
const axios = require('axios');

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:5000';
  const urls = [
    `${base}/api/dynamic-lessons/status`,
    `${base}/api/chat/status`, // may or may not exist; ignore failures
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 5000 });
      console.log(`GET ${url} -> ${res.status}`);
      console.log(JSON.stringify(res.data).slice(0, 600));
    } catch (err) {
      const status = err.response?.status || 'ERR';
      console.log(`GET ${url} -> ${status}`);
      if (err.response?.data) {
        console.log(JSON.stringify(err.response.data).slice(0, 600));
      } else if (err.message) {
        console.log(err.message);
      }
    }
  }
}

main().catch((e) => {
  console.error('Smoke test failed:', e.message);
  process.exit(1);
});
