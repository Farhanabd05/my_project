-- buat check checkout:

-- sebelum:
SELECT 'Saldo Buyer 1' AS Keterangan, balance::TEXT FROM Users WHERE user_id = 1
UNION ALL
SELECT 'Stok Produk di Keranjang Buyer 1' AS Keterangan,
       'ID:' || p.product_id || ' (' || p.product_name || ') Stok:' || p.stock AS detail
FROM Product p
JOIN Cart_Item ci ON p.product_id = ci.product_id
WHERE ci.buyer_id = 1
UNION ALL
SELECT 'Saldo Seller (Harusnya 0)' AS Keterangan,
       'Store ID:' || s.store_id || ' (' || s.store_name || ') Saldo:' || s.balance
FROM Store s JOIN Users u ON s.user_id = u.user_id WHERE u.role = 'SELLER'
UNION ALL
SELECT 'Item Keranjang Buyer 1' AS Keterangan,
       'CartItemID:' || cart_item_id || ' ProdID:' || product_id || ' Qty:' || quantity
FROM Cart_Item WHERE buyer_id = 1
UNION ALL
SELECT 'Pesanan Terakhir Buyer 1 (Sebelumnya)' AS Keterangan,
       'OrderID:' || order_id || ' Status:' || status || ' Tanggal:' || created_at::DATE
FROM "Order"
WHERE buyer_id = 1;

-- sesudah:
SELECT 'Saldo Buyer 1 (Harusnya Berkurang)' AS Keterangan, balance::TEXT FROM Users WHERE user_id = 1
UNION ALL
SELECT 'Stok Produk yg Dibeli (Harusnya Berkurang)' AS Keterangan,
       'ID:' || p.product_id || ' (' || p.product_name || ') Stok:' || p.stock AS detail
FROM Product p WHERE p.product_id IN (11, 13, 19)
UNION ALL
SELECT 'Saldo Seller (Harusnya Tetap 0)' AS Keterangan,
       'Store ID:' || s.store_id || ' (' || s.store_name || ') Saldo:' || s.balance
FROM Store s JOIN Users u ON s.user_id = u.user_id WHERE u.role = 'SELLER'
UNION ALL
SELECT 'Item Keranjang Buyer 1 (Harusnya Kosong)' AS Keterangan,
       'CartItemID:' || cart_item_id || ' ProdID:' || product_id || ' Qty:' || quantity
FROM Cart_Item WHERE buyer_id = 1
UNION ALL
SELECT 'Pesanan Baru Buyer 1 (Harusnya waiting_approval)' AS Keterangan,
       'OrderID:' || order_id || ' Status:' || status || ' Tanggal:' || created_at::DATE
FROM "Order" WHERE buyer_id = 1
UNION ALL
SELECT 'Item Pesanan Baru' AS Keterangan,
       'OrderItemID:' || oi.order_item_id || ' OrdID:' || oi.order_id || ' ProdID:' || oi.product_id || ' Qty:' || oi.quantity
FROM Order_Items oi JOIN "Order" o ON oi.order_id = o.order_id
WHERE o.buyer_id = 1;