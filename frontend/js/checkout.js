const params = new URLSearchParams(window.location.search);
const id = String(params.get("id"));
const qty = Number(params.get("qty")) || 1;

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQDNQ770MsRwOySzRRpwrLjf91t_Dx_WWyLlEym52l2vMfbqev-PZv5HXN0FTVsnPidDRecNVCQBIqg/pub?gid=0&single=true&output=csv";

let currentProduct = null;
let totalTransfer = 0;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("pay-button").addEventListener("click", payNow);
    document.getElementById("confirm-qris-btn").addEventListener("click", confirmQris);
    loadCheckoutData();
});

async function loadCheckoutData() {
    try {
        const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        const products = parseCSV(csvText).map(normalizeProduct).filter(p => p.id && p.name);

        currentProduct = products.find(item => String(item.id) === id);

        if (!currentProduct) {
            alert("Produk tidak ditemukan.");
            window.location.href = 'store.html';
            return;
        }

        renderCheckoutUI();

    } catch (error) {
        console.error("Gagal memuat produk:", error);
        alert("Gagal memuat produk. Periksa koneksi internet.");
    }
}

function renderCheckoutUI() {
    // Basic Details
    document.getElementById("checkout-image").src = currentProduct.image || "assets/logo.png";
    document.getElementById("checkout-name").textContent = currentProduct.name;
    document.getElementById("checkout-category").textContent = "Kategori : " + currentProduct.category;
    document.getElementById("checkout-price").textContent = formatRupiah(currentProduct.price);
    document.getElementById("checkout-qty").textContent = `Kuantitas: ${qty}`;
    
    // Summary
    const baseTotal = currentProduct.price * qty;
    document.getElementById("summary-qty-count").textContent = qty;
    document.getElementById("summary-price").textContent = formatRupiah(baseTotal);

    const emailBox = document.getElementById("email-box");
    const emailNote = document.getElementById("email-note");
    const payBtn = document.getElementById("pay-button");

    if (currentProduct.category === "Top Up") {
        emailBox.style.display = "none"; 
        document.getElementById("summary-total").textContent = formatRupiah(baseTotal);
        payBtn.textContent = "Pesan via WhatsApp";
        payBtn.style.background = "#25D366"; 
    } else {
        emailBox.style.display = "block";
        
        if(currentProduct.category === "Preset") {
            emailNote.textContent = "* Produk Preset akan dikirim otomatis ke email ini setelah pembayaran terdeteksi.";
        } else {
            emailNote.textContent = "* Produk Premium akan dikirim dalam 1x24 jam ke email ini setelah pembayaran terdeteksi.";
        }
        
        // Calculate unique code (assuming numeric ID, or random fallback 1-999)
        let uniqueCode = parseInt(String(currentProduct.id).replace(/\D/g, ''));
        if (isNaN(uniqueCode) || uniqueCode === 0) {
            uniqueCode = Math.floor(Math.random() * 999) + 1; 
        }
        
        // Keep unique code exactly max 3 digits
        uniqueCode = uniqueCode % 1000;
        if(uniqueCode === 0) uniqueCode = 1;

        totalTransfer = baseTotal + uniqueCode;

        document.getElementById("row-kode-unik").style.display = "flex";
        document.getElementById("summary-unique-code").textContent = `+ Rp${uniqueCode}`;
        document.getElementById("summary-total").textContent = formatRupiah(totalTransfer);
        
        payBtn.textContent = "Bayar via QRIS";
        payBtn.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)"; 
    }

    payBtn.disabled = false;
}

function payNow() {
    if (!currentProduct) return alert("Data produk belum selesai dimuat.");

    // Logic for Top Up (Redirect to WA)
    if (currentProduct.category === "Top Up") {
        const text = `Halo JaydreamStore, saya mau order Top Up ${currentProduct.name} sebanyak ${qty} buah.`;
        window.open(`https://wa.me/6282172568157?text=${encodeURIComponent(text)}`, '_blank');
        return;
    }

    // Logic for Preset / Premium (QRIS Check)
    const emailInput = document.getElementById("email");
    const email = emailInput.value.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        alert("Mohon masukkan alamat email yang valid!");
        emailInput.focus();
        return;
    }

    // Hide pay button & email box, show QRIS instructions
    emailInput.disabled = true;
    document.getElementById("pay-button").style.display = "none";
    document.getElementById("qris-instructions").style.display = "block";
    document.getElementById("confirm-qris-btn").style.display = "block";
    
    // Dynamic text based on category
    const deliveryTimeText = currentProduct.category === "Preset" 
        ? "dikirim secara otomatis (Instan)" 
        : "dikirim dalam kurun waktu 1x24 Jam";

    document.getElementById("qris-note").innerHTML = 
        `PENTING: Produk ${currentProduct.name} akan ${deliveryTimeText} ke email <u>${email}</u>. Pastikan transfer sejumlah <strong>${formatRupiah(totalTransfer)}</strong>!`;
}

// FUNGSI BARU: Kirim Data ke Spreadsheet saat tombol ditekan
async function confirmQris() {
    const email = document.getElementById("email").value.trim();
    const btn = document.getElementById("confirm-qris-btn");
    
    btn.textContent = "Mencatat Pesanan...";
    btn.disabled = true;

    const orderData = {
        product: currentProduct.name,
        email: email,
        qty: qty,
        total: totalTransfer
    };

    // TODO: GANTI URL INI DENGAN URL WEB APP GOOGLE APPS SCRIPT KAMU NANTI
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNcx_3ob4vYwpcFHAuJ8gb6zaQ4ycj4unGfVlGo62Qi39Nud73KTLDv-59ysiOmhhVhg/exec";

    try {
        if (SCRIPT_URL !== "PASTE_URL_WEB_APP_GOOGLE_SCRIPT_DI_SINI") {
            await fetch(SCRIPT_URL, {
                method: "POST",
                // Pakai text/plain agar Google Apps Script tidak error CORS Preflight
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(orderData)
            });
        } else {
            console.log("Simulasi (URL Apps Script belum diisi). Data yang akan dikirim:", orderData);
        }

        alert("Pesanan berhasil dicatat! Sistem sedang mengecek mutasi pembayaran QRIS. Jika transfer sesuai nominal (termasuk kode unik), produk akan dikirim ke email kamu.");
        window.location.href = 'store.html';
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal mencatat pesanan. Pastikan koneksi internet lancar.");
        btn.textContent = "Saya Sudah Transfer";
        btn.disabled = false;
    }
}

// ==========================================
// UTILITY FUNCTIONS (CSV PARSER)
// ==========================================
function parseCSV(csv) {
    const rows = []; let row = []; let value = ""; let insideQuotes = false;
    for (let i = 0; i < csv.length; i++) {
        const char = csv[i], next = csv[i + 1];
        if (char === '"' && insideQuotes && next === '"') { value += '"'; i++; continue; }
        if (char === '"') { insideQuotes = !insideQuotes; continue; }
        if (char === "," && !insideQuotes) { row.push(value); value = ""; continue; }
        if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") i++;
            row.push(value); value = "";
            if (row.some(cell => cell.trim() !== "")) rows.push(row);
            row = []; continue;
        }
        value += char;
    }
    if (value !== "" || row.length) {
        row.push(value);
        if (row.some(cell => cell.trim() !== "")) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " "));
    return rows.slice(1).map(row => {
        const item = {};
        headers.forEach((h, index) => { item[h] = (row[index] ?? "").trim(); });
        return item;
    });
}

function normalizeProduct(row) {
    const getValue = (keys) => { for(let k of keys) if(row[k] !== undefined && row[k] !== "") return row[k]; return ""; };
    const parseNumber = (val) => {
        if (!val) return 0;
        const cleaned = String(val).replace(/rp/gi, "").replace(/[\s\.,]/g, "");
        return Number.isFinite(Number(cleaned)) ? Number(cleaned) : 0;
    };
    
    return {
        id: getValue(["id", "kode", "product id", "no"]),
        name: getValue(["nama produk", "nama", "product", "product name"]),
        category: getValue(["type item", "kategori", "category"]),
        price: parseNumber(getValue(["harga", "price", "harga jual"])),
        image: getValue(["foto produk", "foto", "image"]),
    };
}

function formatRupiah(value) {
    return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
