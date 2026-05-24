const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const url = "https://storage.googleapis.com/eas-workflows-production/logs/ed6dfb1b-35d8-41aa-af34-01c56a45ca30/5ba518d1-a902-47e9-a986-b4ea31f87694/2026-05-24T05%3A15%3A22Z-bdd56989-0da2-493e-a633-5315bb865385.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260524%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260524T052933Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=bfa03c3a73313cb4512522fd76a7fef74a3f839397143ea91c00d9299c7459cd6bfb237b2a4950460172753c122f1fedc5e446ee09de18611a7a3f63d2989831de0dc4c21dbafb277bd8f2575b83fc060e84fdd9db1ba9b8d52ab67401d4dbccfe11756ba78d7f24bff2a11df39422344bd12820e7f4b347da2f4bc9b848a9fbb6a2434ffecdf302f6a0b35b608afae52e20a6dc3985f0fa5fb104ab73b23d64888dc0067111f0974db936e11da47319b64cd4ef7d91224c7053f871fc16c76e0cdf7efa346929b285c66bfeb7562e5db05f88358e93b96911308f666c5b3ce808387b8d2603329a351ce01d16935b66a9b4c837a7cc73854cee3b58d0c2c315";

https.get(url, (res) => {
  let chunks = [];
  res.on('data', d => chunks.push(d));
  res.on('end', () => {
    let buffer = Buffer.concat(chunks);
    let logs;
    try {
      logs = zlib.gunzipSync(buffer).toString();
    } catch(e) {
      logs = buffer.toString();
    }
    const lines = logs.split('\n');
    fs.writeFileSync('error_snippet.txt', lines.slice(-200).join('\n'));
    console.log("Done");
  });
});
