<!-- ouutdated -->

<!-- <?php
session_start();
include '../api/get_store_details_info.php'; 

function slugify($string){
    $slug = strtolower($string);
    $slug = preg_replace('/[^a-z0-9]+/','_', $slug);
    $slug = trim($slug, '_');
    return $slug;
}
?>
<link rel="stylesheet" href="/style/card.css">
<?php
$products = $products ?? [];
if (count($products) > 0):
        foreach ($products as $product): 
        $storeSlug = slugify($product['store_name']);
        $productSlug = slugify($product['product_name']);
        ?>
            <div class=product-card>
                <a href="/<?= $storeSlug ?>/<?= $productSlug ?>?product_id=<?= $product['product_id'] ?>&&store_id=<?= $product['store_id'] ?>">
                    <div class="product-card-inner">
                        <div class="product-image-wrapper">
                            <img src="<?= htmlspecialchars($product['main_image_path']) ?>" alt="product image">
                        </div>
                            
                            <p class="product-name"><?= htmlspecialchars($product['product_name']) ?></p>
                            <?php if($product['stock'] > 0): ?>
                                <p class="product-price">Rp<?= number_format($product['price'], 0, ',', '.') ?> ✅</p>
                            <?php else: ?>
                                <p class="product-price">Rp<?= number_format($product['price'], 0, ',', '.') ?> ❌</p>
                            <?php endif;?>
                    </div>
                </a>
                <a href="store_details.php?store_id=<?= $product['store_id'] ?>" class="product-store-link">
                    <p class="product-store">👑 <?= htmlspecialchars($product['store_name']) ?></p>
                </a>
            </div>
        <?php endforeach; ?>
        <?php else: ?>
            <!-- empty state -->
            <h3>Tidak ada produk yang ditemukan!</h3>
        <?php endif; ?>

<input type="hidden" id="totalPages" value="<?= $totalPages ?>">
<input type="hidden" id="currentPage" value="<?= $page ?>">
<input type="hidden" id="categoriesJSON" value="<?= htmlspecialchars(json_encode($categories)) ?>"> -->