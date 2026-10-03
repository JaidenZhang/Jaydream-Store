let products = [];

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDNQ770MsRwOySzRRpwrLjf91t_Dx_WWyLlEym52l2vMfbqev-PZv5HXN0FTVsnPidDRecNVCQBIqg/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
});

async function loadProducts() {
    const container = document.getElementById("products");

    if (!container) return;

    if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE_GOOGLE_SHEET_CSV_URL_HERE")) {
        container.innerHTML = `
            <div class="store-message">
                <h3>Spreadsheet belum terhubung</h3>
                <p>Masukkan URL CSV Google Sheets di variabel SHEET_CSV_URL pada store.js.</p>
            </div>
        `;
        return;
    }

    try {
        container.innerHTML = `
            <div class="store-message">
                <h3>Memuat produk...</h3>
                <p>Harap Menunggu Untuk menghubungkan Server.</p>
            </div>
        `;

        const response = await fetch(SHEET_CSV_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvText = await response.text();

        products = parseCSV(csvText)
            .map(normalizeProduct)
            .filter(product => product.id && product.name);

        if (!products.length) {
            throw new Error("Tidak ada produk valid di spreadsheet.");
        }

        renderProducts(products);

    } catch (error) {
        console.error("Gagal mengambil data spreadsheet:", error);

        container.innerHTML = `
            <div class="store-message">
                <h3>Data produk gagal dimuat</h3>
                <p>Periksa URL spreadsheet, akses publik, dan nama kolomnya.</p>
            </div>
        `;
    }
}

function parseCSV(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const next = csv[i + 1];

        if (char === '"' && insideQuotes && next === '"') {
            value += '"';
            i++;
            continue;
        }

        if (char === '"') {
            insideQuotes = !insideQuotes;
            continue;
        }

        if (char === "," && !insideQuotes) {
            row.push(value);
            value = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value);
            value = "";

            if (row.some(cell => cell.trim() !== "")) {
                rows.push(row);
            }

            row = [];
            continue;
        }

        value += char;
    }

    if (value !== "" || row.length) {
        row.push(value);

        if (row.some(cell => cell.trim() !== "")) {
            rows.push(row);
        }
    }

    if (!rows.length) {
        return [];
    }

    const headers = rows[0].map(header => cleanHeader(header));

    return rows.slice(1).map(row => {
        const item = {};

        headers.forEach((header, index) => {
            item[header] = (row[index] ?? "").trim();
        });

        return item;
    });
}

function cleanHeader(header) {
    return header
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function normalizeProduct(row) {
    const name = getValue(row, ["nama produk", "nama", "product", "product name"]);

    const id = getValue(row, ["id", "kode", "product id", "no"]);

    const originalPrice = parseNumber(
        getValue(row, ["harga asli", "harga normal", "normal price"])
    );

    const promoPrice = parseNumber(
        getValue(row, ["harga promo", "promo price"])
    );

    const normalPrice = parseNumber(
        getValue(row, ["harga", "price", "harga jual", "selling price"])
    );

    const promo = toBoolean(
        getValue(row, ["promo/tidak", "promo", "is promo", "promo tidak"])
    );

    const available = toBoolean(
        getValue(row, ["ketersediaan", "tersedia", "available", "stock"])
    );

    const recommended = toBoolean(
        getValue(row, ["recommended", "recommendation", "rekomendasi"])
    );

    const categoryFromSheet = getValue(
        row,
        ["type item", "kategori", "category", "category name"]
    );

    const image = getValue(
        row,
        ["foto produk", "foto", "image", "gambar", "product image"]
    );

    const preview = getValue(
        row,
        ["review", "preview", "video", "video preview"]
    );

    const finalPrice = promo
        ? (promoPrice || normalPrice || originalPrice)
        : (normalPrice || originalPrice || promoPrice);

    return {
        id,
        name,
        category: categoryFromSheet || detectCategory(name),
        modal: parseNumber(getValue(row, ["modal", "cost", "harga modal"])),
        originalPrice,
        promoPrice,
        promo,
        price: finalPrice,
        available,
        recommended,
        image: normalizeAssetPath(image),
        preview: normalizeAssetPath(preview),
        profit: parseNumber(getValue(row, ["profit", "keuntungan"]))
    };
}

function getValue(row, possibleKeys) {
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== "") {
            return row[key];
        }
    }

    return "";
}

function parseNumber(value) {
    if (value === null || value === undefined || value === "") {
        return 0;
    }

    const cleaned = String(value)
        .replace(/rp/gi, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, "")
        .replace(/[^\d-]/g, "");

    const number = Number(cleaned);

    return Number.isFinite(number) ? number : 0;
}

function toBoolean(value) {
    const normalized = String(value)
        .trim()
        .toLowerCase();

    return normalized === "1" ||
        normalized === "true" ||
        normalized === "yes" ||
        normalized === "ya" ||
        normalized === "tersedia";
}

function normalizeAssetPath(path) {
    if (!path) return "";

    const value = String(path).trim();

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/")
    ) {
        return value;
    }

    return value;
}

function detectCategory(name) {
    const productName = String(name).toLowerCase();

    if (
        productName.includes("diamond") ||
        productName.includes("top up") ||
        productName.includes("topup") ||
        productName.includes("weekly diamond") ||
        productName.includes("first top")
    ) {
        return "Top Up";
    }

    if (productName.includes("preset")) {
        return "Preset";
    }

    return "Premium";
}

function formatRupiah(value) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatVideoUrl(url, autoplay = true, mute = false) {
    if (!url) return '';
    let embedUrl = url;
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        embedUrl = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
        embedUrl = embedUrl.split('&')[0]; 
        embedUrl += `?autoplay=${autoplay ? 1 : 0}&mute=${mute ? 1 : 0}&controls=${mute ? 0 : 1}&loop=1`;
    }
    return embedUrl;
}

window.previewVideo = function(wrapper, videoUrl) {
    if (!videoUrl) return;
    const container = wrapper.querySelector('.video-preview-container');
    if (!container) return;
    
    const embedUrl = formatVideoUrl(videoUrl, true, true); 
    container.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="autoplay; encrypted-media" style="width: 100%; height: 100%; pointer-events: none; border-radius: inherit;"></iframe>`;
    container.style.opacity = '1';
}

window.stopVideoPreview = function(wrapper) {
    const container = wrapper.querySelector('.video-preview-container');
    if (!container) return;
    
    container.innerHTML = '';
    container.style.opacity = '0';
}

window.openVideoModal = function(videoUrl) {
    if (!videoUrl) return;
    
    let modal = document.getElementById('video-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.className = 'modal-overlay';
        modal.setAttribute('onclick', 'closeVideoModal()');
        modal.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <span class="close-btn" onclick="closeVideoModal()">&times;</span>
                <iframe id="modal-video-frame" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            </div>
        `;
        document.body.appendChild(modal);
        
        const style = document.createElement('style');
        style.innerHTML = `
            .modal-overlay {
                display: none;
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }
            .modal-content {
                position: relative;
                width: 90%;
                max-width: 800px;
                aspect-ratio: 16 / 9;
                background: #000;
                border-radius: 12px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            .modal-content iframe {
                width: 100%;
                height: 100%;
                border-radius: 12px;
            }
            .close-btn {
                position: absolute;
                top: -40px;
                right: 0;
                color: #fff;
                font-size: 2rem;
                cursor: pointer;
                transition: opacity 0.2s;
            }
            .close-btn:hover {
                opacity: 0.7;
            }
        `;
        document.head.appendChild(style);
    }
    
    const iframe = document.getElementById('modal-video-frame');
    iframe.src = formatVideoUrl(videoUrl, true, false);
    modal.style.display = 'flex';
}

window.closeVideoModal = function() {
    const modal = document.getElementById('video-modal');
    if (!modal) return;
    
    const iframe = document.getElementById('modal-video-frame');
    iframe.src = '';
    modal.style.display = 'none';
}

function renderProducts(list) {
    const container = document.getElementById("products");

    if (!container) return;

    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = `
            <div class="store-message">
                <h3>Produk tidak ditemukan</h3>
                <p>Coba gunakan kata kunci lain atau pilih kategori berbeda.</p>
            </div>
        `;

        return;
    }

    list.forEach(product => {
        const card = document.createElement("div");

        card.className = "product-card";

        if (product.recommended) {
            card.classList.add("recommended-product");
        }

        if (!product.available) {
            card.classList.add("out-of-stock");
        }

        const media = createProductMedia(product);

        const badges = `
            <div class="product-badges">
                ${product.recommended
                    ? `<span class="product-badge recommended-badge">RECOMMENDED</span>`
                    : ""
                }

                ${product.promo
                    ? `<span class="product-badge promo-badge">PROMO</span>`
                    : ""
                }
            </div>
        `;

        const priceHTML = product.promo && product.originalPrice > product.price
            ? `
                <div class="product-price">
                    <del>${formatRupiah(product.originalPrice)}</del>
                    <span>${formatRupiah(product.price)}</span>
                </div>
            `
            : `
                <div class="product-price">
                    <span>${formatRupiah(product.price)}</span>
                </div>
            `;

        const buttonText = product.available ? "Beli" : "Stok Habis";
        
        const reviewVideo = product.preview; 
        const videoHandlers = reviewVideo 
            ? `onmouseenter="previewVideo(this, '${escapeHTML(reviewVideo)}')" 
               onmouseleave="stopVideoPreview(this)" 
               onclick="openVideoModal('${escapeHTML(reviewVideo)}')"
               style="cursor: pointer;"`
            : "";

        const playIconHTML = reviewVideo 
            ? `<div class="play-icon" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 4; pointer-events: none; opacity: 0.8; transition: opacity 0.2s;">
                 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.5)" stroke="white" stroke-width="1.5"/>
                   <path d="M15.5 11.134C16.1667 11.5189 16.1667 12.4811 15.5 12.866L10.25 15.8971C9.58333 16.282 8.75 15.8009 8.75 15.0311L8.75 8.96887C8.75 8.19907 9.58333 7.71796 10.25 8.10288L15.5 11.134Z" fill="white"/>
                 </svg>
               </div>`
            : "";

        card.innerHTML = `
            <div class="product-media" ${videoHandlers}>
                ${badges}
                ${media}
                <div class="video-preview-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.3s ease-in-out; background: #000; z-index: 3; pointer-events: none;"></div>
                ${playIconHTML}
            </div>

            <div class="product-content">
                <h3>${escapeHTML(product.name)}</h3>

                <p class="product-category">
                    ${escapeHTML(product.category)}
                </p>

                ${priceHTML}

                <button
                    class="product-buy-button"
                    type="button"
                    ${product.available ? "" : "disabled"}>
                    ${buttonText}
                </button>
            </div>
        `;

        if (product.available) {
            const buyButton = card.querySelector(".product-buy-button");

            buyButton.addEventListener("click", (e) => {
                e.stopPropagation(); 
                buyProduct(product.id);
            });
        }

        container.appendChild(card);
    });

    observeProductVideos();
}

function createProductMedia(product) {
    if (product.preview && !product.preview.includes('youtube.com') && !product.preview.includes('youtu.be')) {
        return `
            <video
                class="product-preview"
                muted
                loop
                playsinline
                preload="metadata"
                style="position: relative; z-index: 2;">

                <source
                    src="${escapeHTML(product.preview)}"
                    type="video/mp4">

            </video>
        `;
    }

    const image = product.image || "assets/logo.png";

    return `
        <img
            class="product-preview"
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            style="position: relative; z-index: 2;">
    `;
}

function observeProductVideos() {
    const videos = document.querySelectorAll(
        "#products .product-preview"
    );

    videos.forEach(video => {
        if (video.tagName !== "VIDEO") return;

        video.addEventListener("mouseenter", () => {
            video.play().catch(() => {});
        });

        video.addEventListener("mouseleave", () => {
            video.pause();
            video.currentTime = 0;
        });

        observer.observe(video);
    });
}

const observer = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    },
    {
        threshold: 0.35
    }
);

function searchProduct() {
    const searchInput = document.getElementById("search");

    if (!searchInput) return;

    const keyword = searchInput.value
        .trim()
        .toLowerCase();

    const filtered = products.filter(product =>
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword)
    );

    renderProducts(filtered);
}

function filterCategory(category) {
    if (category === "All") {
        renderProducts(products);
        return;
    }

    const filtered = products.filter(product =>
        product.category === category
    );

    renderProducts(filtered);
}

function buyProduct(id) {
    const product = products.find(
        product => String(product.id) === String(id)
    );

    if (!product || !product.available) {
        return;
    }

    window.location.href =
        `product.html?id=${encodeURIComponent(product.id)}`;
}
