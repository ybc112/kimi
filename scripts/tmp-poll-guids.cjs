require('dotenv').config();
const https = require('https');
const { URLSearchParams } = require('url');

const API_KEY = process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY;
const GUIDS = [
  '1b6ngbac1ejveh3ad6xcijnkm2ywuz94khf3mkmsr3tze7qsba',
  'hm7xdaqbkhrz7f3w5hwa1u3nf52vpmetyylfeedzemknepdij7',
];

function requestJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) },
      timeout: 120000,
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error(raw.slice(0, 300))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const guid of GUIDS) {
    const body = new URLSearchParams({ module: 'contract', action: 'checkverifystatus', apikey: API_KEY, guid }).toString();
    const status = await requestJson(`https://api.etherscan.com/v2/api?chainid=56`, body);
    console.log(guid, JSON.stringify(status));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
