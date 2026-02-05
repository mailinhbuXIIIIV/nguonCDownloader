let selectedEpisodes = [];
let currentMovieSlug = "";

document.getElementById('searchBtn').addEventListener('click', async () => {
    const query = document.getElementById('searchInput').value;
    const response = await fetch(`https://phim.nguonc.com/api/films/search?keyword=${query}`);
    const data = await response.json();
    renderSearch(data.items);
});

function renderSearch(items) {
    const container = document.getElementById('results');
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'movie-card';
        div.innerHTML = `
            <img src="${item.thumb_url}">
            <div>
                <div style="font-weight:bold">${item.name}</div>
                <small>${item.slug}</small>
            </div>
        `;
        div.onclick = () => loadEpisodes(item.slug);
        container.appendChild(div);
    });
}

async function loadEpisodes(slug) {
    currentMovieSlug = slug;
    const response = await fetch(`https://phim.nguonc.com/api/film/${slug}`);
    const data = await response.json();
    const episodes = data.movie.episodes[0].items;

    const area = document.getElementById('episodesArea');
    area.innerHTML = '';
    selectedEpisodes = [];

    episodes.forEach(ep => {
        const btn = document.createElement('div');
        btn.className = 'ep-btn';
        btn.innerText = ep.name;
        btn.onclick = () => {
            btn.classList.toggle('selected');
            const epData = { slug: ep.slug, embed: ep.embed, name: ep.name };
            if (btn.classList.contains('selected')) {
                selectedEpisodes.push(epData);
            } else {
                selectedEpisodes = selectedEpisodes.filter(e => e.slug !== ep.slug);
            }
        };
        area.appendChild(btn);
    });
    document.getElementById('downloadSection').classList.remove('hidden');
}

document.getElementById('startProcessBtn').addEventListener('click', () => {
    if (selectedEpisodes.length === 0) return alert("Select episodes first!");

    // GET THE PATH VALUE
    const customPath = document.getElementById('downloadPath').value.trim();

    chrome.runtime.sendMessage({
        type: "START_CAPTURE_QUEUE",
        episodes: selectedEpisodes,
        movieSlug: currentMovieSlug,
        downloadPath: customPath // Sending the path to background.js
    });
});