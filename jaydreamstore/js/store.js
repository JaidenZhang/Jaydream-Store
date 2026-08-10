let products = [];

fetch("data/products.json")
.then(res => res.json())
.then(data => {

    products = data;

    renderProducts(products);

});


function renderProducts(list){

    const container = document.getElementById("products");

    container.innerHTML = "";

    list.forEach(product => {

        let media;

        // Kalau ada video preview
        if(product.preview && product.preview.trim() !== ""){

            media = `
                <video
                    class="product-preview"
                    muted
                    loop
                    playsinline
                    preload="metadata"
                    onmouseenter="this.play()"
                    onmouseleave="this.pause(); this.currentTime=0;">

                    <source src="${product.preview}" type="video/mp4">

                </video>
            `;

        } 
        
        // Kalau tidak ada video, pakai gambar
        else {

            media = `
                <img
                    class="product-preview"
                    src="${product.image}"
                    alt="${product.name}">
            `;

        }


        container.innerHTML += `

        <div class="product-card">

            ${media}

            <h3>${product.name}</h3>

            <p>${product.category}</p>

            <span>Rp ${product.price.toLocaleString("id-ID")}</span>

            <button onclick="buyProduct(${product.id})">
                Beli
            </button>

        </div>

        `;

    });


    // Cari video yang baru saja dibuat
    const videos = container.querySelectorAll(".product-preview");

    videos.forEach(video => {

        if(video.tagName === "VIDEO"){

            observer.observe(video);

        }

    });

}


const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

        const video = entry.target;

        if(entry.isIntersecting){

            video.play().catch(() => {});

        }else{

            video.pause();

        }

    });

});


function searchProduct(){

    const keyword = document
        .getElementById("search")
        .value
        .toLowerCase();

    const filtered = products.filter(product =>

        product.name.toLowerCase().includes(keyword)

    );

    renderProducts(filtered);

}


function filterCategory(category){

    if(category === "All"){

        renderProducts(products);

        return;

    }

    const filtered = products.filter(product =>

        product.category === category

    );

    renderProducts(filtered);

}


function buyProduct(id){

    window.location.href = `product.html?id=${id}`;

}