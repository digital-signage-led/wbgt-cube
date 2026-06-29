const https = require('https');
const fs = require('fs');
const path = require('path');

const dataId = process.env.ECS_DATA_ID || '1050';
const outPath = path.join(__dirname, '..', 'assets', 'ecs-live.json');
const url = 'https://www.ecs-cloud.ne.jp/Json/WBGTNumData/' +
    encodeURIComponent(dataId) + '?r=' + Date.now();

https.get(url, { headers: { 'User-Agent': 'tokushima-sasakikensetu-signage/1.0' } }, function (res) {
    let body = '';
    res.on('data', function (chunk) { body += chunk; });
    res.on('end', function () {
        if (res.statusCode !== 200) {
            console.error('[refresh-ecs] HTTP', res.statusCode);
            process.exit(1);
        }
        JSON.parse(body);
        fs.writeFileSync(outPath, body, 'utf8');
        console.log('[refresh-ecs] updated', outPath, body.trim());
    });
}).on('error', function (err) {
    console.error('[refresh-ecs]', err.message);
    process.exit(1);
});
