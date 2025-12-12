// show skeleton
function showSkeletons(){
    const container = document.getElementById("product-grid");
    const count =  12;
    container.innerHTML = Array(count)
    .fill('<div class="skeleton-card"></div>')
    .join('');
}

// loading skeleton
function loadProducts(){
    showSkeletons(); // show this while we wait to fetch

    const params = new URLSearchParams(window.location.search);
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "api/get_discovery_product.php?" + params.toString(), true);

    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 400) {
            const html = xhr.responseText;
            try{
                data = JSON.parse(html);
            } catch(err){
                console.error(err);
                return;
            }

            const{products, categories, totalProducts, totalPages, currentPage, cardsPerPage} = data;
            // const currentPage = page;

            const container = document.getElementById("product-grid");
            
            if(!products || products.length===0){
                // empty state
                container.innerHTML = `<h3>Tidak ada produk yang ditemukan!</h3>`;
                return;
            }

            const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

            // render produk
            container.innerHTML = products.map(product=>{
                const storeSlug = slugify(product.store_name);
                const productSlug = slugify(product.product_name);
                const price = new Intl.NumberFormat('id-ID').format(product.price);
                const stockIcon = product.stock>0 ? "✅" : "❌";

                return `
                    <div class=product-card>
                    <a href="/${storeSlug}/${productSlug}?product_id=${product.product_id}&&store_id=${product.store_id}">
                        <div class="product-card-inner">
                            <div class="product-image-wrapper">
                                <img src="${product.main_image_path}" alt="${product.main_image_path}" onerror="this.onerror=null; this.src='/public/uploads/ui/placeholder.png'">
                            </div>
                                <p class="product-name">${product.product_name}</p>
                                <p class="product-price">Rp${price} ${stockIcon}</p>
                        </div>
                    </a>
                    <a href="store_details.php?store_id=${product.store_id}" class="product-store-link">
                        <p class="product-store">👑 ${product.store_name}</p>
                    </a>
                </div>
                `;
            }).join("");

            document.getElementById("paginationText").innerHTML = `
            <label for="pageTextbox">
            Page
            <input
            id="pageTextbox"
            type="number"
            name="page"
            min="1"
            max="${totalPages}"
            value="${currentPage}"
            >
            </label>
            of  
            ${totalPages}
            `;

            // untuk kategori
            const catInput = categories; // dari php template cards product
            if(catInput){
                // const categories = JSON.parse(catInput.value || "[]");
                const selected = new URLSearchParams(window.location.search).getAll("categories[]");
                const fieldset = document.getElementById("categoryFieldset");
                fieldset.innerHTML = "<legend></legend>";
                categories.forEach(cat=>{
                    const checked = selected.includes(String(cat.category_id)) ? "checked" : "";
                    fieldset.innerHTML += `
                        <label>
                            <input
                                type="checkbox"
                                name="categories[]"
                                value="${cat.category_id}"
                                ${checked}
                            >
                            ${cat.name}
                        </label>
                    `;
                })
            }

            // handling untuk paginasi
            const pageInput = document.querySelector("input[name='page']");
            if(pageInput){
                pageInput.addEventListener("change", e=>{
                    goToPage(e.target.value, totalPages);
                });
            }

            document.getElementById("prevPageBtn").onclick = e=>{
                e.preventDefault();
                goToPage(currentPage-1, totalPages);
            };
            document.getElementById("nextPageBtn").onclick = e=>{
                e.preventDefault();
                goToPage(currentPage+1, totalPages);
            };
        } else {
            console.error("Gagal memuat produk");
        }
    };
    xhr.onerror = function() {
        console.error("Error koneksi");
    };
    xhr.send();
}

// debouncing
document.addEventListener("DOMContentLoaded", () =>{
    const searchInput = document.getElementById("searchInput");
    const searchForm = document.getElementById("searchForm");
    let debounceTimer;

    if(!searchInput || !searchForm) return;

    searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            submitFilterForm();
        }, 500);
    })

    searchForm.addEventListener("submit", e=>{
        e.preventDefault();
        submitFilterForm();
    });

    // button cardsPerPage
    document.querySelectorAll("#cardsPerPageButtons button").forEach(btn=>{
        btn.addEventListener("click", e=>{
            const value = e.target.value;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", window.location.pathname, true);
            xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 400) {
                    // document.getElementById("cardsPerPageDisplay").textContent = value;
                    goToPage(1);
                } else {
                    console.error("Gagal update cardsPerPage");
                }
            };
            xhr.onerror = function() {
                console.error("Error koneksi");
            };
            const bodyParams = new URLSearchParams({cardsPerPage: value});
            xhr.send(bodyParams.toString());
        });
    });
    window.addEventListener("popstate", loadProducts);
    loadProducts();
});

function submitFilterForm(){
    const searchForm = document.getElementById("searchForm");
    const query = new URLSearchParams(new FormData(searchForm)).toString();
    history.pushState(null,'','?'+query);
    goToPage(1);
}

// filter
// document.getElementById("searchForm").addEventListener("submit", e=>{
//     e.preventDefault();
//     const query = new URLSearchParams(new FormData(e.target)).toString();
//     history.pushState(null,'','?'+query);
//     loadProducts();
// });

// pagination
function goToPage(page, total=1){
    page = Math.max(1, Math.min(Number(page), total));

    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    history.pushState(null,'','?'+params.toString());
    loadProducts();
}