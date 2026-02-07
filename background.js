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



async function runFfmpeg(args, epName) {

    return new Promise((resolve) => {

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.stderr.on('data', (data) => {

            const line = data.toString();

            const sizeMatch = line.match(/size=\\s*(\\d+[a-zA-Z]+)/);

            const timeMatch = line.match(/time=\\s*(\\d{2}:\\d{2}:\\d{2})/);

            const speedMatch = line.match(/speed=\\s*([\\d.x]+)/);

            if (sizeMatch && timeMatch) {

                const ticks = Math.floor((Date.now() / 200) % 10);

                const bar = "[" + "=".repeat(ticks) + ">" + " ".repeat(10 - ticks) + "]";

                process.stdout.write(\`\\r\${bar} Ep \${epName} | Size: \${sizeMatch[1]} | Time: \${timeMatch[1]} | Speed: \${speedMatch ? speedMatch[1] : '??'}\`);

            }

        });

        ffmpeg.on('close', resolve);

    });

}



async function run() {

    let totalBytes = 0;

    const baseDir = userDefinedPath ? path.resolve(userDefinedPath) : __dirname;

    const showDir = path.join(baseDir, movieSlug);



    console.log("==========================================");

    console.log("FLATTENED JELLYFIN DOWNLOAD: " + (meta.title || movieSlug));

    console.log("PATH: " + showDir);

    console.log("==========================================");



    if (!fs.existsSync(showDir)) fs.mkdirSync(showDir, { recursive: true });



    // 1. GENERATE NFO (This fixes the missing description/plot in Jellyfin)

    const nfoPath = path.join(showDir, 'tvshow.nfo');

    const nfoContent = \`<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>

<tvshow>

    <title>\${meta.title || movieSlug}</title>

    <year>\${meta.year || ''}</year>

    <plot>\${meta.description || ''}</plot>

</tvshow>\`;

    fs.writeFileSync(nfoPath, nfoContent);

    console.log(" Generated tvshow.nfo");



    for (const ep of episodes) {

        // Naming: "Show Name - S01E01.mp4" (Keeps files in one folder but tells Jellyfin they are different episodes)

        const epNum = ep.episodeName.padStart(2, '0');

        const filename = \`\${movieSlug} - S01E\${epNum}.mp4\`;

        const fullPath = path.join(showDir, filename);



        if (fs.existsSync(fullPath)) {

            const size = fs.statSync(fullPath).size;

            console.log(\`\\n[SKIP] \${filename} exists (\${(size/1024/1024).toFixed(2)} MB)\`);

            totalBytes += size;

            continue;

        }



        console.log(\`\\n[DOWNLOADING] \${filename}\`);

        const headers = \`User-Agent: ${ua}\\r\\nReferer: \${ep.origin}/\\r\\nOrigin: \${ep.origin}\\r\\n\`;

        const args = [

            '-headers', headers, 

            '-extension_picky', '0', 

            '-allowed_extensions', 'ALL', 

            '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',

            '-i', ep.url, 

            '-map', '0',

            '-c', 'copy', 

            '-movflags', 'use_metadata_tags',

            '-metadata', \`title=\${meta.title || movieSlug} - S01E\${epNum}\`,

            '-metadata', \`description=\${meta.description || ''}\`,

            '-metadata', \`comment=\${meta.description || ''}\`,

            '-metadata', \`date=\${meta.year || ''}\`,

            '-metadata', \`genre=Reality-TV\`, 

            '-stats', 

            fullPath

        ];



        await runFfmpeg(args, ep.episodeName);



        if (fs.existsSync(fullPath)) {

            const finalSize = fs.statSync(fullPath).size;

            totalBytes += finalSize;

            process.stdout.write(\`\\n [FINISHED] \${filename} (\${(finalSize / 1024 / 1024).toFixed(2)} MB)\\n\`);

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
