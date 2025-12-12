<?php 
session_start();

// trik mengatasi form resubmission
if($_SERVER['REQUEST_METHOD'] === 'POST'){
    if(isset($_POST['cardsPerPage'])){
        $_SESSION['cardsPerPage'] = $_POST['cardsPerPage'];
    }
    header("Location: ". $_SERVER['PHP_SELF'] . "?" . $_SERVER['QUERY_STRING']);
    exit;
}
$cardsPerPage = $_SESSION['cardsPerPage'] ?? 8;

include 'api/get_navbar_data.php'; 
include 'component/navbar.php'; 
// include 'api/get_discovery_product.php'; 
?>

<!DOCTYPE HTML>
<html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="/style/card.css">
        <link rel="stylesheet" href="/style/discovery.css">
        
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">

        <title>Product Discovery</title>
    </head>
    <body>
    <div class="discovery-header">
        <img src="/public/uploads/ui/banner.png" alt="Nimonspedia Banner">
    </div>
    
    <!-- Filter, form hanlding -->
    <form method="get" id="searchForm">
        <div class="container-all-filter">
            <!-- product name search -->
            <div class="container-search-box-and-minmax">
                <div class="container-search-box">
                    <img class="search-svg" src="public/uploads/ui/search.svg" alt="Search Icon">
                    <label for="searchInput"></label>
                    <input
                    type="text"
                    name="search"
                    id="searchInput"
                    placeholder="Cari produk..."
                    value="<?= htmlspecialchars($_GET['search'] ?? '')?>"
                    autocomplete="off"
                    >
                </div>
                
                <!-- price range -->
                <label for="minPriceInput">Min Price:
                    <input id="minPriceInput" type="number" name="min" placeholder="0" min=0>
                </label>
                <label for="maxPriceInput">Max Price:
                    <input id="maxPriceInput" type="number" name="max" placeholder="100000000" max=999999999>
                </label>
                <button class="filter-btn primary" type="submit">Filter</button>
            </div>
        </div>

        <!-- categorical search -->
        <fieldset id="categoryFieldset">
            <legend></legend>
            <!-- di-handle oleh js -->
        </fieldset>
        <button class="filter-btn backup" type="submit">Filter</button>
    </form>

    <!-- cardsPerPage button -->
    <div id="cardsPerPageButtons">
        <button name="cardsPerPage" value=4>4</button>
        <button name="cardsPerPage" value=8>8</button>
        <button name="cardsPerPage" value=12>12</button>
        <button name="cardsPerPage" value=20>20</button>
    </div>

    <!-- <h3 style="display:none" id="cardsPerPageDisplay"><?= $cardsPerPage ?></h3> -->

    <!-- cards -->
    <div id="product-grid">
        <!-- di-handle oleh js -->
    </div>

    <!-- pagination -->
    <form id="paginationForm" method="get">
        <a id="prevPageBtn" class="page-link" href="#">Prev</a>
        <p id="paginationText"></p>
        <a id="nextPageBtn" class="page-link" href="#">Next</a>
</form>
<script src="public/discovery.js"></script>
</body>
<?php include 'component/footer.php'?>
</html>