let selectedEpisodes = [];
let allEpisodesInCurrentMovie = []; // To track all for "Select All"
let currentMovieSlug = "";
let currentMovieMetadata = {};
let currentPage = 1;
let currentQuery = "";

document.getElementById('searchBtn').addEventListener('click', () => {
    currentQuery = document.getElementById('searchInput').value;
    if (!currentQuery) return alert("Nhập tên phim!");
    currentPage = 1;
    fetchResults();
});

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchResults();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    fetchResults();
});

// "Select All" Logic
document.getElementById('selectAllBtn').addEventListener('click', () => {
    const buttons = document.querySelectorAll('.ep-btn');
    const isSelectingAll = selectedEpisodes.length < allEpisodesInCurrentMovie.length;

    selectedEpisodes = [];
    buttons.forEach((btn, index) => {
        const ep = allEpisodesInCurrentMovie[index];
        if (isSelectingAll) {
            btn.classList.add('selected');
            selectedEpisodes.push(ep);
        } else {
            btn.classList.remove('selected');
        }
    });

    document.getElementById('selectAllBtn').innerText = isSelectingAll ? "Bỏ chọn tất cả" : "Chọn tất cả";
});

async function fetchResults() {
    const container = document.getElementById('results');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Đang tìm kiếm...</div>';

    const url = `https://phim.nguonc.com/api/films/search?keyword=${currentQuery}&page=${currentPage}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        renderSearch(data.items);
        renderPagination(data.paginate);
    } catch (e) {
        container.innerHTML = 'Lỗi kết nối API.';
    }
}

function renderSearch(items) {
    const container = document.getElementById('results');
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">Không tìm thấy phim.</div>';
        return;
    }

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

function renderPagination(paginate) {
    const controls = document.getElementById('paginationControls');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (!paginate || paginate.total_page <= 1) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    currentPage = paginate.current_page;
    pageInfo.innerText = `Trang ${currentPage} / ${paginate.total_page}`;

    prevBtn.disabled = (currentPage === 1);
    nextBtn.disabled = (currentPage === paginate.total_page);
}

async function loadEpisodes(slug) {
    currentMovieSlug = slug;
    const response = await fetch(`https://phim.nguonc.com/api/film/${slug}`);
    const data = await response.json();

    currentMovieMetadata = {
        title: data.movie.name,
        description: data.movie.description,
        year: data.movie.category["3"]?.list[0]?.name || "",
        cast: data.movie.casts,
        poster: data.movie.poster_url,
        thumb_url: data.movie.thumb_url
    };

    allEpisodesInCurrentMovie = data.movie.episodes[0].items.map(ep => ({
        slug: ep.slug, embed: ep.embed, name: ep.name
    }));

    const area = document.getElementById('episodesArea');
    area.innerHTML = '';
    selectedEpisodes = [];
    document.getElementById('selectAllBtn').innerText = "Chọn tất cả";

    allEpisodesInCurrentMovie.forEach(ep => {
        const btn = document.createElement('div');
        btn.className = 'ep-btn';
        btn.innerText = ep.name;
        btn.onclick = () => {
            btn.classList.toggle('selected');
            if (btn.classList.contains('selected')) {
                selectedEpisodes.push(ep);
            } else {
                selectedEpisodes = selectedEpisodes.filter(e => e.slug !== ep.slug);
            }
            // Update button text dynamically
            document.getElementById('selectAllBtn').innerText =
                (selectedEpisodes.length === allEpisodesInCurrentMovie.length) ? "Bỏ chọn" : "Chọn tất cả";
        };
        area.appendChild(btn);
    });
    document.getElementById('downloadSection').classList.remove('hidden');
    document.getElementById('downloadSection').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('startProcessBtn').addEventListener('click', () => {
    if (selectedEpisodes.length === 0) return alert("Chọn ít nhất 1 tập!");
    chrome.runtime.sendMessage({
        type: "START_CAPTURE_QUEUE",
        episodes: selectedEpisodes,
        movieSlug: currentMovieSlug,
        downloadPath: document.getElementById('downloadPath').value.trim(),
        metadata: currentMovieMetadata
    });
});
