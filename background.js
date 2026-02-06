chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

const AD_RULES = [
    { "id": 1, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "*pmolink*", "resourceTypes": ["xmlhttprequest", "media", "other"] }},
    { "id": 2, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "*finallygotthexds.site*", "resourceTypes": ["xmlhttprequest", "media", "other"] }},
    { "id": 3, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "streamc.xyz/1.mp4", "resourceTypes": ["media", "xmlhttprequest"] }},
    { "id": 4, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "raw.githubusercontent.com/hiller1233456/milo543*", "resourceTypes": ["xmlhttprequest"] }}
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2, 3, 4], addRules: AD_RULES });
});

let captureQueue = [];
let capturedResults = [];
let movieSlug = "";
let userPath = "";
let movieMeta = {};

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "START_CAPTURE_QUEUE") {
        captureQueue = [...message.episodes];
        movieSlug = message.movieSlug;
        userPath = message.downloadPath || "";
        movieMeta = message.metadata || {};
        capturedResults = [];
        processNextInQueue();
    }
});

async function processNextInQueue() {
    if (captureQueue.length === 0) {
        generateNodeScript();
        return;
    }
    const currentEp = captureQueue.shift();
    const tab = await chrome.tabs.create({ url: currentEp.embed, active: false });

    const onM3u8Found = (details) => {
        if (details.tabId === tab.id && details.url.includes(".m3u8") && !details.url.includes("ads")) {
            const urlObj = new URL(details.url);
            capturedResults.push({
                episodeName: currentEp.name,
                url: details.url,
                origin: urlObj.origin
            });
            chrome.webRequest.onBeforeRequest.removeListener(onM3u8Found);
            chrome.tabs.remove(tab.id, () => setTimeout(processNextInQueue, 2000));
        }
    };
    chrome.webRequest.onBeforeRequest.addListener(onM3u8Found, { urls: ["<all_urls>"] });
}

function generateNodeScript() {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";

    let script = `
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const episodes = ${JSON.stringify(capturedResults, null, 2)};
const meta = ${JSON.stringify(movieMeta, null, 2)};
const movieSlug = "${movieSlug}";
const userDefinedPath = "${userPath.replace(/\\/g, '\\\\')}";

function downloadPoster(url, dest) {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("[POSTER] Saved poster.jpg for Jellyfin");
                resolve();
            });
        }).on('error', () => resolve());
    });
}

async function runFfmpeg(args, onProgress) {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.stderr.on('data', (data) => {
            const line = data.toString();
            if (line.includes('size=') || line.includes('time=')) onProgress(line);
        });
        ffmpeg.on('close', resolve);
    });
}

async function run() {
    let totalBytes = 0;
    const baseDir = userDefinedPath ? path.resolve(userDefinedPath) : __dirname;
    const finalDir = path.join(baseDir, movieSlug);

    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

    console.log("==========================================");
    console.log("MOVIE: " + (meta.title || movieSlug));
    console.log("SAVING TO: " + finalDir);
    console.log("==========================================");

    // Download poster for Jellyfin/Plex
    await downloadPoster(meta.poster || meta.thumb_url, path.join(finalDir, "poster.jpg"));

    for (const ep of episodes) {
        const filename = \`\${movieSlug}-\${ep.episodeName}.mp4\`;
        const fullPath = path.join(finalDir, filename);

        if (fs.existsSync(fullPath)) {
            console.log(\`[SKIP] \${filename} exists.\`);
            continue;
        }

        console.log(\`\\n[DOWNLOADING] \${filename}\`);
        
        const headers = \`User-Agent: ${ua}\\r\\nReferer: \${ep.origin}/\\r\\nOrigin: \${ep.origin}\\r\\n\`;
        
        const args = [
            '-headers', headers,
            '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
            '-i', ep.url,
            '-map', '0',
            '-c', 'copy',
            '-movflags', 'use_metadata_tags',
            // Global metadata
            '-metadata:g', \`title=\${meta.title} - \${ep.episodeName}\`,
            '-metadata:g', \`comment=\${meta.description || ''}\`,
            '-metadata:g', \`artist=\${meta.cast || ''}\`,
            '-metadata:g', \`date=\${meta.year || ''}\`,
            '-metadata:g', \`description=\${meta.description || ''}\`,
            '-metadata:g', \`genre=TV Show\`,
            // Stream-level metadata (helps some picky players)
            '-metadata:s:v:0', \`title=\${meta.title} - \${ep.episodeName}\`,
            '-metadata:s:v:0', \`comment=\${meta.description || ''}\`,
            '-stats', 
            fullPath
        ];

        await runFfmpeg(args, (line) => {
            const sizeMatch = line.match(/size=\\s*(\\d+[a-zA-Z]+)/);
            if (sizeMatch) {
                process.stdout.write(\`\\r Progress: \${sizeMatch[1]}\`);
            }
        });

        if (fs.existsSync(fullPath)) totalBytes += fs.statSync(fullPath).size;
    }

    console.log("\\n" + "=".repeat(40));
    console.log(\`DONE! Total Space: \${(totalBytes / 1024 / 1024).toFixed(2)} MB\`);
    if (process.platform === 'darwin') spawn('afplay', ['/System/Library/Sounds/Glass.aiff']);
}

run().catch(console.error);
`;

    const blob = new Blob([script], { type: 'text/javascript' });
    const reader = new FileReader();
    reader.onload = () => {
        chrome.downloads.download({ url: reader.result, filename: `download.js` });
    };
    reader.readAsDataURL(blob);
}
