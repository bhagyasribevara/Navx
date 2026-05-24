const https = require('https');
const fs = require('fs');
const zlib = require('zlib');

const url = "https://storage.googleapis.com/eas-workflows-production/logs/ed6dfb1b-35d8-41aa-af34-01c56a45ca30/5ba518d1-a902-47e9-a986-b4ea31f87694/2026-05-24T05%3A15%3A22Z-bdd56989-0da2-493e-a633-5315bb865385.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260524%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260524T060259Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=066a41493378ec94bb4b03a5bfdb62d05b9fcd982fc8232fd7032306c58c726caef74c7ce450f3dac908382a08c22c7ae42605907903771662d563b4f9944f30f1e7668b9da01665253a9233d308a122e262ad9e960497f2be4c230ef5d8e67bcfa551534c1b746824a3f5333e9bec3700a5aa3a36cf30b82043802b89e850c42e8b8247d9d9a656f16329cedefcadb6c6566ecfece4a9d703c60ebb24af6328397f96cd6c1b44f5026b2b238a5e5a0a1991ec70c324ae13a852d154f191c80b0d78735bfa0c08c281ea15b7f5932f205426fe896b0eb81470ff223c87630ae1e2c197b5d94b8986035364c0acc9435cfbd65d7e562db8e9db718a0cfaee578a";

https.get(url, (res) => {
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
        outputLines = lines.slice(-200);
    }
    fs.writeFileSync('error_snippet_first.txt', outputLines.join('\n'));
    console.log("Done");
  });
});
