const https = require('https');
const fs = require('fs');
const zlib = require('zlib');

const url = "https://storage.googleapis.com/eas-workflows-production/logs/ed6dfb1b-35d8-41aa-af34-01c56a45ca30/514ac4a9-2831-4482-89ea-6a17d3a30fe2/2026-05-24T05%3A58%3A02Z-a093b9ce-9ed7-4790-8754-5f708aeb6522.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260524%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260524T060033Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=5d871c60136a381e642ea0c9aebd9e84a99a4a3fbb1f88535a14ea244a5daa26d7821795eb74cc7760455fdc61a256720eec71fa837780387e0031d5da575ae05a026a929775af005441ffe21860db972a70ecc4e78924b8cdbe4f0c8e5ce3e6ae740767b45580a1d2593d17198e265ab3de6c42cf017ce5e03b3b281a1f0513f4cc4cc92eeb1ddd1123bd29756b2320377bcbea10e3c2bb125a80f198df13590bdeb7622ddc6a5545d9b10da57425f023b9814471a5b01fd146d98905c2fb7178cc597cfc1fff082119114cc37782b0e451983d908d08dcd739fe0d0d338c0470ef9e3ee588676847379689c7a45a2048d0ab38c840aca3e4ab752ded05a5fc";

https.get(url, (res) => {
  console.log("Headers:", res.headers);
  let chunks = [];
  res.on('data', d => chunks.push(d));
  res.on('end', () => {
    let buffer = Buffer.concat(chunks);
    let text;
    try {
      if (res.headers['content-encoding'] === 'gzip' || buffer[0] === 0x1f && buffer[1] === 0x8b) {
        text = zlib.gunzipSync(buffer).toString();
      } else if (res.headers['content-encoding'] === 'br') {
        text = zlib.brotliDecompressSync(buffer).toString();
      } else {
        text = buffer.toString();
      }
    } catch(e) {
      console.error("Decompress error:", e.message);
      text = buffer.toString();
    }
    const lines = text.split('\n');
    let outputLines = [];
    for(let i = 0; i < lines.length; i++) {
        if(lines[i].includes("FAILURE") || lines[i].includes("FAILED") || lines[i].includes("What went wrong")) {
            const start = Math.max(0, i - 15);
            const end = Math.min(lines.length, i + 30);
            outputLines.push(...lines.slice(start, end));
            break;
        }
    }
    if (outputLines.length === 0) {
        outputLines = lines.slice(-200); // just grab the last 200 lines if we don't find it
    }
    fs.writeFileSync('error_snippet.txt', outputLines.join('\n'));
    console.log("Done");
  });
});
