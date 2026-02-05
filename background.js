const AD_RULES = [
    { "id": 1, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "*pmolink*", "resourceTypes": ["xmlhttprequest", "media", "other"] }},
    { "id": 2, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "*finallygotthexds.site*", "resourceTypes": ["xmlhttprequest", "media", "other"] }},
    { "id": 3, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "streamc.xyz/1.mp4", "resourceTypes": ["media", "xmlhttprequest"] }},
    { "id": 4, "priority": 1, "action": { "type": "block" }, "condition": { "urlFilter": "raw.githubusercontent.com/hiller1233456/milo543*", "resourceTypes": ["xmlhttprequest"] }}
];

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2, 3, 4], addRules: AD_RULES });
});

let captureQueue = [];
let capturedResults = [];
let movieSlug = "";
let userPath = "";

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "START_CAPTURE_QUEUE") {
        captureQueue = [...message.episodes];
        movieSlug = message.movieSlug;
        userPath = message.downloadPath || ""; // Store the custom path
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

const episodes = ${JSON.stringify(capturedResults, null, 2)};
const movieSlug = "${movieSlug}";
const userDefinedPath = "${userPath.replace(/\\/g, '\\\\')}"; // Handle Windows backslashes

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

    // PATH LOGIC: If blank, use __dirname. Otherwise, resolve the user path.
    const baseDir = userDefinedPath ? path.resolve(userDefinedPath) : __dirname;
    const finalDir = path.join(baseDir, movieSlug);

    console.log("==========================================");
    console.log("STARTING DOWNLOAD: " + movieSlug);
    console.log("SAVING TO: " + finalDir);
    console.log("==========================================");

    if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });

    for (const ep of episodes) {
        const filename = \`\${movieSlug}-\${ep.episodeName}.mp4\`;
        const fullPath = path.join(finalDir, filename);

        if (fs.existsSync(fullPath)) {
            const size = fs.statSync(fullPath).size;
            console.log(\`[SKIP] \${filename} exists (\${(size/1024/1024).toFixed(2)} MB)\`);
            totalBytes += size;
            continue;
        }

        console.log(\`\\n[DOWNLOADING] \${filename}\`);
        
        const headers = \`User-Agent: ${ua}\\r\\nReferer: \${ep.origin}/\\r\\nOrigin: \${ep.origin}\\r\\n\`;
        const args = ['-headers', headers, '-extension_picky', '0', '-allowed_extensions', 'ALL', '-protocol_whitelist', 'file,http,https,tcp,tls,crypto', '-i', ep.url, '-c', 'copy', '-stats', fullPath];

        await runFfmpeg(args, (line) => {
            const sizeMatch = line.match(/size=\\s*(\\d+[a-zA-Z]+)/);
            const timeMatch = line.match(/time=\\s*([\\d:.]+)/);
            const speedMatch = line.match(/speed=\\s*([\\d.x]+)/);
            
            if (sizeMatch && timeMatch) {
                const ticks = Math.floor((Date.now() / 200) % 10);
                const bar = "[" + "=".repeat(ticks) + ">" + " ".repeat(10 - ticks) + "]";
                process.stdout.write(\`\\r\${bar} Size: \${sizeMatch[1]} | Time: \${timeMatch[1]} | Speed: \${speedMatch ? speedMatch[1] : '??'}\`);
            }
        });

        if (fs.existsSync(fullPath)) {
            const finalSize = fs.statSync(fullPath).size;
            totalBytes += finalSize;
            console.log(\`\\n[FINISHED] \${filename} (\${(finalSize / 1024 / 1024).toFixed(2)} MB)\`);
        }
    }

    console.log("\\n" + "=".repeat(40));
    console.log(\`ALL DOWNLOADS COMPLETE!\`);
    console.log(\`Total Space Used: \${(totalBytes / 1024 / 1024).toFixed(2)} MB\`);
    
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