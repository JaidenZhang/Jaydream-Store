let qty = 1;
let currentProduct = null;
const params = new URLSearchParams(window.location.search);
const id = String(params.get("id"));

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDNQ770MsRwOySzRRpwrLjf91t_Dx_WWyLlEym52l2vMfbqev-PZv5HXN0FTVsnPidDRecNVCQBIqg/pub?gid=0&single=true&output=csv";

document.addEventListener("DOMContentLoaded", () => {
    loadProductDetail();
});

async function loadProductDetail() {
    try {
        const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        const products = parseCSV(csvText)
            .map(normalizeProduct)
            .filter(product => product.id && product.name);

        currentProduct = products.find(item => String(item.id) === id);

        if (!currentProduct) {
            alert("Produk tidak ditemukan.");
            window.location.href = 'store.html';
            return;
        }

        // Update DOM Elements
        const imgEl = document.getElementById("product-image");
        if (imgEl) imgEl.src = currentProduct.image || "assets/logo.png";

        const nameEl = document.getElementById("product-name");
        if (nameEl) nameEl.innerHTML = escapeHTML(currentProduct.name);

        const priceEl = document.getElementById("product-price");
        if (priceEl) priceEl.innerHTML = formatRupiah(currentProduct.price);

        const catEl = document.getElementById("product-category");
        if (catEl) catEl.innerHTML = escapeHTML(currentProduct.category);

        const descEl = document.getElementById("product-description");
        if (descEl) {
            // Karena di spreadsheet tidak ada kolom deskripsi khusus, kita beri fallback text
            // Atau tautan ke video preview jika tersedia.
            descEl.innerHTML = currentProduct.preview 
                ? `<a href="${currentProduct.preview}" target="_blank" style="color: var(--primary); font-weight: bold; text-decoration: underline;">Lihat Video Review</a>`
                : "Produk digital berkualitas dari JaydreamStore.";
        }

        // Set initial qty
        const qtyEl = document.getElementById("qty");
        if (qtyEl) qtyEl.innerHTML = qty;

    } catch (error) {
        console.error("Error loading product:", error);
        alert("Gagal memuat produk. Pastikan koneksi internet stabil.");
    }
}

function plus() {
    qty++;
    const qtyEl = document.getElementById("qty");
    if (qtyEl) qtyEl.innerHTML = qty;
}

function minus() {
    if (qty > 1) {
        qty--;
        const qtyEl = document.getElementById("qty");
        if (qtyEl) qtyEl.innerHTML = qty;
    }
}

function buyNow() {
    if (!currentProduct) {
        alert("Tunggu sebentar, data produk sedang dimuat.");
        return;
    }
    
    if (!currentProduct.available) {
        alert("Maaf, produk ini sedang tidak tersedia (Stok Habis).");
        return;
    }

    window.location.href = `checkout.html?id=${encodeURIComponent(currentProduct.id)}&qty=${qty}`;
}

// ==========================================
// UTILITY FUNCTIONS (SAMA SEPERTI STORE.JS)
// ==========================================

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

    if (!rows.length) return [];

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
    return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeProduct(row) {
    const name = getValue(row, ["nama produk", "nama", "product", "product name"]);
    const id = getValue(row, ["id", "kode", "product id", "no"]);
    const originalPrice = parseNumber(getValue(row, ["harga asli", "harga normal", "normal price"]));
    const promoPrice = parseNumber(getValue(row, ["harga promo", "promo price"]));
    const normalPrice = parseNumber(getValue(row, ["harga", "price", "harga jual", "selling price"]));
    
    const promo = toBoolean(getValue(row, ["promo/tidak", "promo", "is promo", "promo tidak"]));
    const available = toBoolean(getValue(row, ["ketersediaan", "tersedia", "available", "stock"]));
    const recommended = toBoolean(getValue(row, ["recommended", "recommendation", "rekomendasi"]));
    
    const categoryFromSheet = getValue(row, ["type item", "kategori", "category", "category name"]);
    const image = getValue(row, ["foto produk", "foto", "image", "gambar", "product image"]);
    const preview = getValue(row, ["review", "preview", "video", "video preview"]);

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
    if (value === null || value === undefined || value === "") return 0;
    const cleaned = String(value).replace(/rp/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "").replace(/[^\d-]/g, "");
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : 0;
}

function toBoolean(value) {
    const normalized = String(value).trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "ya" || normalized === "tersedia";
}

function normalizeAssetPath(path) {
    if (!path) return "";
    const value = String(path).trim();
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
        return value;
    }
    return value;
}

function detectCategory(name) {
    const productName = String(name).toLowerCase();
    if (productName.includes("diamond") || productName.includes("top up") || productName.includes("topup") || productName.includes("weekly diamond") || productName.includes("first top")) {
        return "Top Up";
    }
    if (productName.includes("preset")) return "Preset";
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
