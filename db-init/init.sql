-- Dihasilkan oleh Skrip Python Faker --

-- Menghapus tabel lama jika ada --
DROP TABLE IF EXISTS "Order_Items", "Order", "Category_Item", "Category", "Cart_Item", "Product", "Store", "Users" CASCADE;
DROP TYPE IF EXISTS user_role, order_status;

-- Membuat Tipe ENUM --
CREATE TYPE user_role AS ENUM ('BUYER', 'SELLER', 'ADMIN');
CREATE TYPE order_status AS ENUM ('waiting_approval', 'approved', 'rejected', 'on_delivery', 'received');
CREATE TYPE features AS ENUM ('checkout_enabled', 'chat_enabled', 'auction_enabled');

-- === MEMBUAT TABEL === --

    CREATE TABLE Users (
        user_id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
        role user_role NOT NULL, name VARCHAR(255) NOT NULL, address TEXT,
        balance INT NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    

    CREATE TABLE Store (
        store_id SERIAL PRIMARY KEY, user_id INT UNIQUE NOT NULL, store_name VARCHAR(255) UNIQUE NOT NULL,
        store_description TEXT, store_logo_path VARCHAR(255), balance INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
    );
    

        CREATE TABLE Product (
            product_id SERIAL PRIMARY KEY, store_id INT NOT NULL, product_name VARCHAR(255) NOT NULL,
            description TEXT, price INT NOT NULL CHECK (price >= 0), stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
            main_image_path VARCHAR(255), 
            
            tags TEXT[] NULL, -- KOLOM TAG BARU (PostgreSQL Array)
            
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TIMESTAMP NULL,
            
            -- KITA UBAH INI: BUKAN LAGI 'GENERATED'
            search_vector tsvector NULL, -- Hanya kolom tsvector biasa
            
            FOREIGN KEY (store_id) REFERENCES Store(store_id)
        );
        

    CREATE OR REPLACE FUNCTION update_product_search_vector()
    RETURNS trigger AS $$
    BEGIN
        -- Ini adalah logika yang sama dengan yang kita punya sebelumnya
        -- 'NEW' mengacu pada baris baru yang akan dimasukkan/diperbarui
        NEW.search_vector :=
            to_tsvector('english',
                COALESCE(NEW.product_name, '') || ' ' ||
                COALESCE(NEW.description, '') || ' ' ||
                COALESCE(array_to_string(NEW.tags, ' '), '')
            );
        RETURN NEW; -- Kembalikan baris baru yang sudah dimodifikasi
    END;
    $$ LANGUAGE plpgsql;
    

    CREATE TRIGGER tsvector_update_trigger
    BEFORE INSERT OR UPDATE ON Product
    FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();
    

    CREATE TABLE Cart_Item (
        cart_item_id SERIAL PRIMARY KEY, buyer_id INT NOT NULL, product_id INT NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES Users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES Product(product_id) ON DELETE CASCADE
    );
    

    CREATE TABLE Category (
        category_id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL
    );
    

    CREATE TABLE Category_Item (
        category_id INT NOT NULL, product_id INT NOT NULL,
        PRIMARY KEY (category_id, product_id),
        FOREIGN KEY (category_id) REFERENCES Category(category_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES Product(product_id) ON DELETE CASCADE
    );
    

    CREATE TABLE "Order" (
        order_id SERIAL PRIMARY KEY, buyer_id INT NOT NULL, store_id INT NOT NULL,
        total_price INT NOT NULL CHECK (total_price >= 0), shipping_address TEXT NOT NULL,
        status order_status NOT NULL DEFAULT 'waiting_approval', reject_reason TEXT NULL,
        confirmed_at TIMESTAMP NULL, delivery_time TIMESTAMP NULL, received_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES Users(user_id),
        FOREIGN KEY (store_id) REFERENCES Store(store_id)
    );
    

    CREATE TABLE Order_Items (
        order_item_id SERIAL PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0), price_at_order INT NOT NULL, subtotal INT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES "Order"(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES Product(product_id)
    );

    -- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES Product(product_id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    starting_price INTEGER NOT NULL,
    current_price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    last_bid_time TIMESTAMP,
    winner_id INTEGER REFERENCES Users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ending_soon_notified BOOLEAN DEFAULT FALSE,
    quantity INT DEFAULT 1,
    min_increment DECIMAL(15, 2) DEFAULT 10000
);

-- Auction bids table
CREATE TABLE IF NOT EXISTS auction_bids (
    id SERIAL PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id INTEGER NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    bid_amount INTEGER NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_bid_per_auction UNIQUE (auction_id, bidder_id, bid_time)
);

-- Feature access
CREATE TABLE feature_access (
    access_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    feature_name features NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, feature_name)
);

-- Safeguard untuk update feature
CREATE UNIQUE INDEX unique_feature_global_and_user
ON feature_access (COALESCE(user_id, -1), feature_name);

-- WebSocket tickets table
CREATE TABLE IF NOT EXISTS ws_tickets (
    id SERIAL PRIMARY KEY,
    ticket VARCHAR(255) UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Push_Subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE, -- Endpoint harus unik agar tidak duplikat
    p256dh_key VARCHAR(255) NOT NULL,
    auth_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- Tabel untuk pengaturan preferensi notifikasi user
CREATE TABLE IF NOT EXISTS Push_Preferences (
    user_id INT PRIMARY KEY,
    chat_enabled BOOLEAN DEFAULT TRUE,
    auction_enabled BOOLEAN DEFAULT TRUE,
    order_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE TABLE Notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

ALTER TABLE Notifications 
ADD COLUMN type VARCHAR(20) DEFAULT 'general';

-- Insert default preferences saat user baru register (bisa via Trigger atau Aplikasi)
-- cth manual insert untuk user yang sudah ada:
INSERT INTO Push_Preferences (user_id) SELECT user_id FROM Users ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_start_time ON auctions(start_time);
CREATE INDEX idx_auction_bids_auction_id ON auction_bids(auction_id);
    
CREATE INDEX idx_ws_tickets_ticket ON ws_tickets(ticket);
CREATE INDEX idx_ws_tickets_expires ON ws_tickets(expires_at);
-- Index agar pencarian berdasarkan user_id cepat saat mau kirim notif
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON Push_Subscriptions(user_id);
--- 1. KATEGORI (WAJIB) ---
INSERT INTO Category (name) VALUES ('Elektronik');
INSERT INTO Category (name) VALUES ('Pakaian');
INSERT INTO Category (name) VALUES ('Makanan & Minuman');
INSERT INTO Category (name) VALUES ('Mainan & Hobi');
INSERT INTO Category (name) VALUES ('Otomotif');
-- 1. Hapus tabel lama jika salah nama
DROP TABLE IF EXISTS chat_rooms CASCADE; 
DROP TABLE IF EXISTS chat_messages CASCADE;

-- 2. Buat Tabel chat_room (Sesuai Standar Tim B)
CREATE TABLE chat_room (
    id SERIAL PRIMARY KEY,
    buyer_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES Store(store_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(buyer_id, store_id)
);

-- 3. Buat Tabel chat_messages
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    
    -- [BARU] Kolom untuk fitur Image & Item Preview
    message_type VARCHAR(20) DEFAULT 'text',
    attachment_info JSONB DEFAULT NULL,
    
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tambahkan Index untuk Performa
CREATE INDEX IF NOT EXISTS idx_chat_room_buyer ON chat_room(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_store ON chat_room(store_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_ws_tickets_ticket ON ws_tickets(ticket);

--- 2. PENGGUNA (BUYER & SELLER) ---
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer1@nimon.com', '$2b$12$LEFaHn2ZIx6MoB7s9pt7sepT1J2IEddUkS/63eQRgAtOz1VSke7U6', 'BUYER', 'Tgk. Gasti Marpaung, S.H.', 'Jl. Ahmad Dahlan No. 816, Depok, Maluku Utara 31169', 14930050);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer2@nimon.com', '$2b$12$lAxpO149PMv63KuTpD3D1.CBDXxYWObgKAz3vfG82q7grUzL4IzUi', 'BUYER', 'Luwar Nababan', 'Gang Dipenogoro No. 7, Meulaboh, RI 46425', 18918270);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer3@nimon.com', '$2b$12$y9T2SLQALpXdEWcAcOmpruDoVBf01Cc.3NV9zSbAIvWEhcewZpd8u', 'BUYER', 'Karman Uyainah', 'Jl. Ronggowarsito No. 92, Kota Administrasi Jakarta Pusat, LA 59715', 15043500);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer4@nimon.com', '$2b$12$KAF5ESFVUjChMJY.QlbIZ.53i3YTsYinIZxigA0G1hYVmnkmtOcLO', 'BUYER', 'Drs. Nugraha Prabowo', 'Gg. M.T Haryono No. 220, Pagaralam, Kalimantan Timur 20754', 14769780);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer5@nimon.com', '$2b$12$csaLkyF2VgiTINq4whple.J.cTE2zi18So6uk2ArlxGuRqnyDrVBK', 'BUYER', 'Drs. Olivia Nashiruddin', 'Jalan Rajawali Timur No. 02, Tasikmalaya, KB 61622', 14085490);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer6@nimon.com', '$2b$12$gEYQBGgfQOrRmArib8CGG.WsrLaqHtKD92P4xl78gFXsUQmuqBufu', 'BUYER', 'Lukman Utama', 'Gg. Jend. A. Yani No. 296, Sungai Penuh, LA 13376', 10560780);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer7@nimon.com', '$2b$12$bENVPr4/jsUMFprkh9ALM.dP6XFwd3Sa8C2ACn34gIzn5uEq2HtyW', 'BUYER', 'Ganjaran Purnawati', 'Jalan Moch. Toha No. 6, Pagaralam, SS 94441', 4498950);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer8@nimon.com', '$2b$12$lgoDGPXrcS9R1TN0m/Nm.uVNdncrpo1RfJXqS2rWWphQ41i6ZMxO.', 'BUYER', 'dr. Karimah Lestari', 'Jl. Tebet Barat Dalam No. 621, Singkawang, Gorontalo 77695', 757120);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer9@nimon.com', '$2b$12$dSPXyQnacZ6VJ0voO0YE3.6N2zh2I84jn6TJBiym4Vcl/nV0QZ/VO', 'BUYER', 'Puti Almira Zulkarnain, S.Gz', 'Gang S. Parman No. 223, Semarang, SU 80278', 19579290);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer10@nimon.com', '$2b$12$weB7afBG50BufzMmApXLq.xduVDbsvdTmpczmEoFhjyksmMYLFo5y', 'BUYER', 'Elma Prasetya', 'Jalan Gedebage Selatan No. 7, Jambi, Sulawesi Tenggara 69338', 633450);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer11@nimon.com', '$2b$12$VmORpOCkfyXXmTg1wv09seHrhy5r41LGyyLBLgak8ZKTno7jRebx6', 'BUYER', 'Irnanto Riyanti', 'Jl. Kiaracondong No. 50, Banda Aceh, Bengkulu 90449', 15026570);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer12@nimon.com', '$2b$12$66Hqg8HdONjZ/CrJGHs5jOIr4D7J6b6rNyhJ/AN9NK0ySqmOWfVee', 'BUYER', 'Mursita Situmorang, S.Gz', 'Jalan S. Parman No. 18, Tomohon, PA 87995', 6295280);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer13@nimon.com', '$2b$12$aF5vo.jotvmgbhzrTEtmUu1.U4.Wirg8FOpDhc3cCJlUcvxi2pHEy', 'BUYER', 'Fitriani Rajasa', 'Gang Erlangga No. 6, Mataram, PA 79370', 17308610);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer14@nimon.com', '$2b$12$yM26mZ72bJq3CSao26QLFeA0VF9N7W64XbglgWKzbL/EW.2xBd7IW', 'BUYER', 'Keisha Puspita', 'Jalan Kendalsari No. 757, Bitung, Bengkulu 83062', 9877020);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer15@nimon.com', '$2b$12$ViO8ig7BczC8dGPMdOSdWe0gKJRg5IMZxScHiFgtNLtAF1ClVmSbK', 'BUYER', 'Jarwadi Maryadi', 'Gang Sentot Alibasa No. 636, Tangerang Selatan, Nusa Tenggara Barat 56790', 1641960);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer16@nimon.com', '$2b$12$JPy.qHMzqo9lBqSjbj7mIOvJB.B0MVerj4WWCFe76LWXMym/Kupey', 'BUYER', 'Kayla Waskita', 'Jl. Bangka Raya No. 20, Pasuruan, NB 56355', 17893670);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer17@nimon.com', '$2b$12$18ENgk/EPI/d6wV3gdNONuqmAaaXzNTO/EzYhkrCFZmIz6jVoDWXq', 'BUYER', 'Puspa Kusmawati', 'Jl. Raya Setiabudhi No. 77, Kota Administrasi Jakarta Barat, Sulawesi Utara 31349', 16862210);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer18@nimon.com', '$2b$12$gFFdEp0Ix5osFO3pW/WlX.zQESa82KzyM7h8FYsgRjsPgyJRgZdPi', 'BUYER', 'Sutan Halim Ramadan', 'Jalan Kendalsari No. 4, Malang, RI 50434', 7423410);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer19@nimon.com', '$2b$12$jakRt0LeFcanpRgRnfKXruxx.nMrxkPVwLHa6Y5D/iKWfDgyYtRZ6', 'BUYER', 'Dr. Tantri Palastri', 'Gg. Veteran No. 438, Palu, KB 15155', 9487330);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('buyer20@nimon.com', '$2b$12$/9ZDjVeku8J9cWUrj56X1OcgMgURw9I2Oog8SeYYiVKFj0KSoJdqy', 'BUYER', 'Caturangga Dongoran', 'Gang Dipatiukur No. 0, Purwokerto, PB 95606', 16779940);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('seller21@nimon.com', '$2b$12$gAkLf7IIRR.lTOSZLXTvKeG31PvhbGjTfJ566SXsSpsok6/owI6Ay', 'SELLER', 'Wirda Palastri, S.T.', 'Jl. Soekarno Hatta No. 9, Pekalongan, BB 00077', 0);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('seller22@nimon.com', '$2b$12$GkX2zRW0MDa6AEAMl2B7teX8.RyIZntHP5zGdGd1Cwzg0QrlZ8P/y', 'SELLER', 'dr. Tina Budiyanto', 'Gg. Ahmad Dahlan No. 9, Salatiga, Sulawesi Tenggara 27874', 0);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('seller23@nimon.com', '$2b$12$8mLqq/fJA6vErRQdjd2bLu9xpQJBi7qfMF0mRHVqhGnpQ6J5QLA6m', 'SELLER', 'Cut Calista Lazuardi', 'Jl. Siliwangi No. 9, Semarang, BA 68114', 0);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('seller24@nimon.com', '$2b$12$U7gwknhyXH4/nQ5mpkkfxOZTWanFTpRrItVgsAnrKK0sOPuAAS.re', 'SELLER', 'Maida Santoso, M.TI.', 'Jl. Ahmad Dahlan No. 01, Bitung, Jambi 27199', 0);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('seller25@nimon.com', '$2b$12$7DfizL9kbTlVE8QZ.VnX3eLfcGMV5JVcacSFSEPsWDcBQnncRY9Ry', 'SELLER', 'Yance Sinaga', 'Jalan Wonoayu No. 4, Serang, SN 61460', 0);
INSERT INTO Users (email, password, role, name, address, balance) VALUES ('admin@nimon.com', '$2b$10$S/NeJ4.4F8grXM3l/d0gk.kiltL684wbPS8tH0YD0z1PP6VPvNrIW', 'ADMIN', 'Shioriko Mifune', '-', 0);

--- 3. TOKO (MILIK SELLER) ---
INSERT INTO Store (user_id, store_name, store_description, store_logo_path, balance) VALUES (21, 'Perum Rahayu Pertiwi', '<b>Stand-alone modular Graphical User Interface</b>', '/images/store/fake_logo.png', 0);
INSERT INTO Store (user_id, store_name, store_description, store_logo_path, balance) VALUES (22, 'UD Haryanti Tbk', '<b>Persevering 24/7 interface</b>', '/images/store/fake_logo.png', 0);
INSERT INTO Store (user_id, store_name, store_description, store_logo_path, balance) VALUES (23, 'CV Anggraini Andriani', '<b>Programmable actuating methodology</b>', '/images/store/fake_logo.png', 0);
INSERT INTO Store (user_id, store_name, store_description, store_logo_path, balance) VALUES (24, 'PD Sitompul', '<b>Fully-configurable zero-defect data-warehouse</b>', '/images/store/fake_logo.png', 0);
INSERT INTO Store (user_id, store_name, store_description, store_logo_path, balance) VALUES (25, 'Perum Waluyo Tbk', '<b>Decentralized intermediate forecast</b>', '/images/store/fake_logo.png', 0);

--- 4. PRODUK (MILIK TOKO) ---
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Men''s Cotton Combed T-Shirt Zaitun 318', 'Soft and comfortable plain t-shirt. Made from 100% Cotton Combed 30s material.', 452534, 180, '/images/products/fake_product.png', ARRAY['pakaian', 'kaos', 'fashion', 'pria', 'cotton', 'shirt']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Dell XPS 13 Ultrabook Putih 217', 'The ultimate Windows ultrabook. InfinityEdge bezel-less display, compact body. Intel Core i5 processor.', 421745, 113, '/images/products/fake_product.png', ARRAY['laptop', 'dell', 'elektronik', 'komputer', 'ultrabook', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Men''s Flannel Long-Sleeve Shirt Ungu 669', 'Classic plaid flannel shirt. Soft cotton material. Perfect for casual wear.', 333170, 2, '/images/products/fake_product.png', ARRAY['pakaian', 'kemeja', 'fashion', 'pria', 'flannel', 'shirt']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Men''s Running Shoes Sneakers Merah marun 797', 'Lightweight athletic running shoes. Breathable mesh upper for comfort.', 81084, 86, '/images/products/fake_product.png', ARRAY['sepatu', 'sneakers', 'fashion', 'pria', 'olahraga', 'running', 'shoes']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Men''s Cotton Combed T-Shirt Coklat tua 611', 'Soft and comfortable plain t-shirt. Made from 100% Cotton Combed 30s material.', 358936, 25, '/images/products/fake_product.png', ARRAY['pakaian', 'kaos', 'fashion', 'pria', 'cotton', 'shirt']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Green Tea Bags (25 bags) Coklat tua 469', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 199884, 154, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Dell XPS 13 Ultrabook Abu-abu 209', 'The ultimate Windows ultrabook. InfinityEdge bezel-less display, compact body. Intel Core i5 processor.', 263869, 108, '/images/products/fake_product.png', ARRAY['laptop', 'dell', 'elektronik', 'komputer', 'ultrabook', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'KYT Full Face Helmet Abu-abu 789', 'Full face motorcycle helmet from KYT. SNI and DOT certified. Aerodynamic design.', 23035, 158, '/images/products/fake_product.png', ARRAY['otomotif', 'helm', 'motor', 'aksesoris motor', 'kyt', 'helmet']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Logitech MX Master 3S Mouse Merah jambu 279', 'Wireless performance mouse for productivity. MagSpeed scrolling. Quiet click. 8K DPI sensor.', 263101, 56, '/images/products/fake_product.png', ARRAY['mouse', 'logitech', 'aksesoris', 'komputer', 'wireless', 'bluetooth']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (1, 'Chicken Nugget Frozen Food 500gr Hijau muda 553', 'Delicious chicken nuggets. Frozen food, easy to cook. 500gr pack.', 65689, 9, '/images/products/fake_product.png', ARRAY['makanan', 'beku', 'frozen food', 'ayam', 'nugget']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'One Piece Action Figure - Luffy Hijau tua 195', 'High-quality collectible action figure of Monkey D. Luffy from One Piece. Gear 5 edition.', 75249, 3, '/images/products/fake_product.png', ARRAY['mainan', 'hobi', 'koleksi', 'action figure', 'one piece', 'luffy', 'anime']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Yamaha F310 Acoustic Guitar Ungu 698', 'Best-selling acoustic guitar for beginners. Great tone and quality. Includes a free gig bag.', 314192, 156, '/images/products/fake_product.png', ARRAY['hobi', 'alat musik', 'gitar', 'yamaha', 'acoustic']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Google Pixel 8 Pro Ungu tua 512', 'The smartest smartphone camera. Best-in-class AI features from Google. Tensor G3 chip.', 163157, 158, '/images/products/fake_product.png', ARRAY['smartphone', 'google', 'pixel', 'gadget', 'elektronik', 'hp', 'android', 'ai', 'camera']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Dell XPS 13 Ultrabook Merah marun 234', 'The ultimate Windows ultrabook. InfinityEdge bezel-less display, compact body. Intel Core i5 processor.', 217892, 92, '/images/products/fake_product.png', ARRAY['laptop', 'dell', 'elektronik', 'komputer', 'ultrabook', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Logitech MX Master 3S Mouse Ungu 467', 'Wireless performance mouse for productivity. MagSpeed scrolling. Quiet click. 8K DPI sensor.', 326957, 191, '/images/products/fake_product.png', ARRAY['mouse', 'logitech', 'aksesoris', 'komputer', 'wireless', 'bluetooth']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Legion 15 Gaming Laptop Coklat 301', 'High-performance gaming laptop with Intel Core i7, Nvidia RTX 4060 VGA, and 16GB RAM. 165Hz screen.', 225572, 82, '/images/products/fake_product.png', ARRAY['laptop', 'gaming', 'lenovo', 'elektronik', 'komputer', 'ram', 'vga', 'nvidia', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Green Tea Bags (25 bags) Abu-abu 907', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 423189, 161, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Macbook Pro 14 Inch M3 Merah jambu 470', 'Blazing-fast M3 Pro chip for creative professionals. Liquid Retina XDR display. Thin aluminum design. 18GB RAM.', 5994, 1, '/images/products/fake_product.png', ARRAY['laptop', 'apple', 'macbook', 'elektronik', 'komputer', 'pro', 'm3']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'One Piece Action Figure - Luffy Emas 220', 'High-quality collectible action figure of Monkey D. Luffy from One Piece. Gear 5 edition.', 238076, 63, '/images/products/fake_product.png', ARRAY['mainan', 'hobi', 'koleksi', 'action figure', 'one piece', 'luffy', 'anime']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (2, 'Men''s Slim Fit Jeans Coklat 919', 'Modern slim fit stretch denim jeans. Comfortable and stylish for daily use.', 150432, 154, '/images/products/fake_product.png', ARRAY['pakaian', 'celana', 'jeans', 'fashion', 'pria', 'slim fit']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Facial Serum with Niacinamide Biru laut 297', 'Brightening facial serum with 10% Niacinamide and Zinc. Helps reduce dark spots.', 189693, 80, '/images/products/fake_product.png', ARRAY['kecantikan', 'skincare', 'kesehatan', 'wajah', 'serum', 'niacinamide']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Casio G-Shock Watch Jingga 343', 'Classic G-Shock digital watch. Shock resistant and 200M water resistant.', 386649, 190, '/images/products/fake_product.png', ARRAY['jam tangan', 'fashion', 'aksesoris', 'pria', 'casio', 'g-shock', 'watch']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Google Pixel 8 Pro Merah jambu 413', 'The smartest smartphone camera. Best-in-class AI features from Google. Tensor G3 chip.', 216623, 142, '/images/products/fake_product.png', ARRAY['smartphone', 'google', 'pixel', 'gadget', 'elektronik', 'hp', 'android', 'ai', 'camera']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Green Tea Bags (25 bags) Merah marun 941', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 173233, 37, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'One Piece Action Figure - Luffy Emas 612', 'High-quality collectible action figure of Monkey D. Luffy from One Piece. Gear 5 edition.', 31500, 58, '/images/products/fake_product.png', ARRAY['mainan', 'hobi', 'koleksi', 'action figure', 'one piece', 'luffy', 'anime']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Dell XPS 13 Ultrabook Abu-abu 449', 'The ultimate Windows ultrabook. InfinityEdge bezel-less display, compact body. Intel Core i5 processor.', 395109, 150, '/images/products/fake_product.png', ARRAY['laptop', 'dell', 'elektronik', 'komputer', 'ultrabook', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Corsa Tubeless Motorcycle Tire Emas 541', 'Corsa Platinum R99 tubeless tire for motorcycles. Excellent grip on wet and dry roads.', 103015, 104, '/images/products/fake_product.png', ARRAY['otomotif', 'ban', 'motor', 'spare part', 'corsa', 'tire']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Samsung Galaxy S24 Ultra Coklat 888', 'Flagship smartphone with S Pen included. 200MP camera with incredible zoom. Galaxy AI features. Best Android phone.', 129816, 161, '/images/products/fake_product.png', ARRAY['smartphone', 'samsung', 'gadget', 'elektronik', 'hp', 's pen', 'ai', 'android']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Men''s Slim Fit Jeans Hijau 585', 'Modern slim fit stretch denim jeans. Comfortable and stylish for daily use.', 71613, 153, '/images/products/fake_product.png', ARRAY['pakaian', 'celana', 'jeans', 'fashion', 'pria', 'slim fit']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (3, 'Women''s Oversized Hoodie Emas 842', 'Cozy oversized fleece hoodie. Perfect for a relaxed and stylish look.', 443117, 46, '/images/products/fake_product.png', ARRAY['pakaian', 'jaket', 'fashion', 'wanita', 'hoodie', 'oversized']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Eiger Laptop Backpack Kuning 452', 'Durable backpack with dedicated 15-inch laptop sleeve. Water-resistant. Good for daily commute or hiking.', 207066, 16, '/images/products/fake_product.png', ARRAY['tas', 'fashion', 'aksesoris', 'laptop', 'ransel', 'eiger', 'backpack']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Yamaha F310 Acoustic Guitar Biru muda 462', 'Best-selling acoustic guitar for beginners. Great tone and quality. Includes a free gig bag.', 130998, 74, '/images/products/fake_product.png', ARRAY['hobi', 'alat musik', 'gitar', 'yamaha', 'acoustic']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Green Tea Bags (25 bags) Emas 970', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 260106, 40, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'HP Spectre x360 14 Merah marun 194', 'Premium 2-in-1 convertible laptop. Folds into a tablet. Luxury design, long battery life. Touchscreen included.', 155545, 155, '/images/products/fake_product.png', ARRAY['laptop', 'hp', 'elektronik', 'komputer', '2-in-1', 'convertible', 'tablet', 'touchscreen']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Yamaha F310 Acoustic Guitar Hijau muda 991', 'Best-selling acoustic guitar for beginners. Great tone and quality. Includes a free gig bag.', 449903, 31, '/images/products/fake_product.png', ARRAY['hobi', 'alat musik', 'gitar', 'yamaha', 'acoustic']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Samsung 34" Ultrawide Monitor Perak 731', 'Curved ultrawide monitor for immersive gaming and productivity. 100Hz refresh rate. QLED technology.', 472962, 99, '/images/products/fake_product.png', ARRAY['monitor', 'samsung', 'elektronik', 'komputer', 'ultrawide', 'gaming', 'curved']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Men''s Flannel Long-Sleeve Shirt Koral 290', 'Classic plaid flannel shirt. Soft cotton material. Perfect for casual wear.', 355708, 33, '/images/products/fake_product.png', ARRAY['pakaian', 'kemeja', 'fashion', 'pria', 'flannel', 'shirt']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'Dell XPS 13 Ultrabook Nila 317', 'The ultimate Windows ultrabook. InfinityEdge bezel-less display, compact body. Intel Core i5 processor.', 22852, 183, '/images/products/fake_product.png', ARRAY['laptop', 'dell', 'elektronik', 'komputer', 'ultrabook', 'intel']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'KYT Full Face Helmet Biru muda 479', 'Full face motorcycle helmet from KYT. SNI and DOT certified. Aerodynamic design.', 157246, 63, '/images/products/fake_product.png', ARRAY['otomotif', 'helm', 'motor', 'aksesoris motor', 'kyt', 'helmet']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (4, 'ASUS Zenbook Duo (2024) Hitam 411', 'Dual-screen innovation for multitasking. Lightweight and powerful with Intel Core Ultra 9 processor and 32GB RAM. OLED screen.', 132024, 122, '/images/products/fake_product.png', ARRAY['laptop', 'asus', 'elektronik', 'komputer', 'zenbook', 'dual screen', 'intel', 'oled']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Logitech G Pro X Mechanical Keyboard Merah jambu 700', 'Professional-grade mechanical gaming keyboard. Swappable GX Blue Clicky switches. Tenkeyless (TKL) design.', 21287, 179, '/images/products/fake_product.png', ARRAY['keyboard', 'logitech', 'aksesoris', 'komputer', 'gaming', 'mechanical']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Men''s Slim Fit Jeans Biru 971', 'Modern slim fit stretch denim jeans. Comfortable and stylish for daily use.', 258138, 75, '/images/products/fake_product.png', ARRAY['pakaian', 'celana', 'jeans', 'fashion', 'pria', 'slim fit']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Logitech G Pro X Mechanical Keyboard Hijau 356', 'Professional-grade mechanical gaming keyboard. Swappable GX Blue Clicky switches. Tenkeyless (TKL) design.', 92204, 72, '/images/products/fake_product.png', ARRAY['keyboard', 'logitech', 'aksesoris', 'komputer', 'gaming', 'mechanical']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Google Pixel 8 Pro Merah 363', 'The smartest smartphone camera. Best-in-class AI features from Google. Tensor G3 chip.', 39537, 22, '/images/products/fake_product.png', ARRAY['smartphone', 'google', 'pixel', 'gadget', 'elektronik', 'hp', 'android', 'ai', 'camera']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Samsung Galaxy S24 Ultra Biru muda 763', 'Flagship smartphone with S Pen included. 200MP camera with incredible zoom. Galaxy AI features. Best Android phone.', 393481, 82, '/images/products/fake_product.png', ARRAY['smartphone', 'samsung', 'gadget', 'elektronik', 'hp', 's pen', 'ai', 'android']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Green Tea Bags (25 bags) Emas 324', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 202983, 157, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Corsa Tubeless Motorcycle Tire Koral 144', 'Corsa Platinum R99 tubeless tire for motorcycles. Excellent grip on wet and dry roads.', 197577, 200, '/images/products/fake_product.png', ARRAY['otomotif', 'ban', 'motor', 'spare part', 'corsa', 'tire']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Facial Serum with Niacinamide Hijau 612', 'Brightening facial serum with 10% Niacinamide and Zinc. Helps reduce dark spots.', 355358, 112, '/images/products/fake_product.png', ARRAY['kecantikan', 'skincare', 'kesehatan', 'wajah', 'serum', 'niacinamide']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'Green Tea Bags (25 bags) Merah jambu 132', 'Premium green tea bags. Rich in antioxidants. A healthy and refreshing drink.', 263775, 183, '/images/products/fake_product.png', ARRAY['makanan', 'minuman', 'teh', 'sehat', 'tea']);
INSERT INTO Product (store_id, product_name, description, price, stock, main_image_path, tags) VALUES (5, 'HP Spectre x360 14 Merah 700', 'Premium 2-in-1 convertible laptop. Folds into a tablet. Luxury design, long battery life. Touchscreen included.', 142946, 131, '/images/products/fake_product.png', ARRAY['laptop', 'hp', 'elektronik', 'komputer', '2-in-1', 'convertible', 'tablet', 'touchscreen']);

--- 5. KATEGORI PRODUK ---
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 1);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 2);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 3);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 4);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 5);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 6);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 7);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 8);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 9);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 10);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 11);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 12);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 13);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 14);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 15);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 16);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 17);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 18);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 19);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 20);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 21);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 22);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 23);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 24);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 25);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 26);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 27);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 28);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 29);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 30);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 31);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 32);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 33);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 34);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 35);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 36);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 37);
INSERT INTO Category_Item (category_id, product_id) VALUES (2, 38);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 39);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 40);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 41);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 42);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 43);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 44);
INSERT INTO Category_Item (category_id, product_id) VALUES (1, 45);
INSERT INTO Category_Item (category_id, product_id) VALUES (4, 46);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 47);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 48);
INSERT INTO Category_Item (category_id, product_id) VALUES (3, 49);
INSERT INTO Category_Item (category_id, product_id) VALUES (5, 50);

--- 6. ISI KERANJANG (CART) ---
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (3, 14, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (20, 9, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (7, 31, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (6, 33, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (2, 41, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (18, 18, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (20, 12, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (6, 6, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (8, 15, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (16, 6, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (7, 45, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (11, 40, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (19, 20, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (14, 31, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (8, 27, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (11, 8, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (10, 9, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (19, 16, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (19, 21, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (15, 20, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (9, 13, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (13, 22, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (5, 31, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (8, 12, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (4, 22, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (9, 19, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (18, 21, 1);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (14, 47, 3);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (1, 1, 2);
INSERT INTO Cart_Item (buyer_id, product_id, quantity) VALUES (15, 7, 2);

--- 7. RIWAYAT PESANAN (ORDER) ---
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (15, 3, 0, 'Gang Sentot Alibasa No. 636, Tangerang Selatan, Nusa Tenggara Barat 56790', 'approved', '2025-06-07 00:38:32', '2025-06-18 12:16:18');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (1, 23, 1, 216623, 216623);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (1, 26, 2, 395109, 790218);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (1, 26, 2, 395109, 790218);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (1, 24, 2, 173233, 346466);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (1, 25, 3, 31500, 94500);
UPDATE "Order" SET total_price = 2238025 WHERE order_id = 1;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (19, 4, 0, 'Gg. Veteran No. 438, Palu, KB 15155', 'approved', '2025-05-15 06:19:24', '2025-07-14 03:08:35');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (2, 37, 2, 355708, 711416);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (2, 33, 2, 260106, 520212);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (2, 36, 3, 472962, 1418886);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (2, 33, 1, 260106, 260106);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (2, 36, 3, 472962, 1418886);
UPDATE "Order" SET total_price = 4329506 WHERE order_id = 2;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time, received_at) VALUES (10, 5, 0, 'Jalan Gedebage Selatan No. 7, Jambi, Sulawesi Tenggara 69338', 'received', '2025-04-06 15:31:24', '2025-10-18 02:15:44', '2025-10-31 09:38:47', '2025-11-10 08:28:26');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (3, 47, 3, 197577, 592731);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (3, 42, 3, 258138, 774414);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (3, 44, 2, 39537, 79074);
UPDATE "Order" SET total_price = 1446219 WHERE order_id = 3;
UPDATE Store SET balance = balance + 1446219 WHERE store_id = 5;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time, received_at) VALUES (18, 3, 0, 'Jalan Kendalsari No. 4, Malang, RI 50434', 'received', '2025-02-25 10:39:24', '2025-10-12 02:28:34', '2025-10-25 15:41:31', '2025-10-30 16:15:38');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (4, 27, 3, 103015, 309045);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (4, 23, 3, 216623, 649869);
UPDATE "Order" SET total_price = 958914 WHERE order_id = 4;
UPDATE Store SET balance = balance + 958914 WHERE store_id = 3;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (7, 4, 0, 'Jalan Moch. Toha No. 6, Pagaralam, SS 94441', 'waiting_approval', '2025-02-24 18:03:53');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (5, 33, 2, 260106, 520212);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (5, 35, 1, 449903, 449903);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (5, 31, 3, 207066, 621198);
UPDATE "Order" SET total_price = 1591313 WHERE order_id = 5;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (5, 2, 0, 'Jalan Rajawali Timur No. 02, Tasikmalaya, KB 61622', 'waiting_approval', '2025-03-21 05:50:42');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (6, 20, 1, 150432, 150432);
UPDATE "Order" SET total_price = 150432 WHERE order_id = 6;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time) VALUES (12, 1, 0, 'Jalan S. Parman No. 18, Tomohon, PA 87995', 'on_delivery', '2025-11-04 16:08:07', '2025-11-07 01:44:59', '2025-11-10 14:39:58');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (7, 5, 1, 358936, 358936);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (7, 7, 2, 263869, 527738);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (7, 8, 2, 23035, 46070);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (7, 10, 2, 65689, 131378);
UPDATE "Order" SET total_price = 1064122 WHERE order_id = 7;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, reject_reason) VALUES (6, 2, 0, 'Gg. Jend. A. Yani No. 296, Sungai Penuh, LA 13376', 'rejected', '2025-06-24 15:44:40', '2025-09-05 03:38:41', 'Cumque laborum deserunt.');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (8, 13, 2, 163157, 326314);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (8, 14, 3, 217892, 653676);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (8, 17, 1, 423189, 423189);
UPDATE "Order" SET total_price = 1403179 WHERE order_id = 8;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time) VALUES (19, 5, 0, 'Gg. Veteran No. 438, Palu, KB 15155', 'on_delivery', '2025-10-25 22:47:41', '2025-10-30 02:37:43', '2025-11-09 06:44:57');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (9, 43, 2, 92204, 184408);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (9, 42, 1, 258138, 258138);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (9, 45, 2, 393481, 786962);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (9, 46, 1, 202983, 202983);
UPDATE "Order" SET total_price = 1432491 WHERE order_id = 9;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time, received_at) VALUES (11, 3, 0, 'Jl. Kiaracondong No. 50, Banda Aceh, Bengkulu 90449', 'received', '2025-09-23 09:45:21', '2025-11-09 04:51:59', '2025-11-13 07:19:28', '2025-11-13 13:54:48');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (10, 27, 3, 103015, 309045);
UPDATE "Order" SET total_price = 309045 WHERE order_id = 10;
UPDATE Store SET balance = balance + 309045 WHERE store_id = 3;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (16, 3, 0, 'Jl. Bangka Raya No. 20, Pasuruan, NB 56355', 'waiting_approval', '2025-05-21 18:38:43');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (11, 27, 1, 103015, 103015);
UPDATE "Order" SET total_price = 103015 WHERE order_id = 11;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (10, 1, 0, 'Jalan Gedebage Selatan No. 7, Jambi, Sulawesi Tenggara 69338', 'approved', '2025-10-08 20:37:13', '2025-11-04 01:42:07');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (12, 5, 1, 358936, 358936);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (12, 6, 3, 199884, 599652);
UPDATE "Order" SET total_price = 958588 WHERE order_id = 12;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (18, 3, 0, 'Jalan Kendalsari No. 4, Malang, RI 50434', 'approved', '2025-01-08 10:42:42', '2025-03-26 13:42:06');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (13, 27, 3, 103015, 309045);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (13, 21, 2, 189693, 379386);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (13, 23, 2, 216623, 433246);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (13, 21, 3, 189693, 569079);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (13, 27, 2, 103015, 206030);
UPDATE "Order" SET total_price = 1896786 WHERE order_id = 13;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (4, 5, 0, 'Gg. M.T Haryono No. 220, Pagaralam, Kalimantan Timur 20754', 'approved', '2025-10-04 18:13:36', '2025-11-05 09:26:19');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (14, 48, 2, 355358, 710716);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (14, 43, 3, 92204, 276612);
UPDATE "Order" SET total_price = 987328 WHERE order_id = 14;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (6, 4, 0, 'Gg. Jend. A. Yani No. 296, Sungai Penuh, LA 13376', 'waiting_approval', '2025-06-23 23:07:14');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (15, 40, 3, 132024, 396072);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (15, 40, 1, 132024, 132024);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (15, 35, 2, 449903, 899806);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (15, 36, 1, 472962, 472962);
UPDATE "Order" SET total_price = 1900864 WHERE order_id = 15;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (18, 4, 0, 'Jalan Kendalsari No. 4, Malang, RI 50434', 'waiting_approval', '2025-08-08 03:12:50');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (16, 32, 3, 130998, 392994);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (16, 31, 1, 207066, 207066);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (16, 32, 1, 130998, 130998);
UPDATE "Order" SET total_price = 731058 WHERE order_id = 16;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at) VALUES (4, 4, 0, 'Gg. M.T Haryono No. 220, Pagaralam, Kalimantan Timur 20754', 'approved', '2025-03-19 02:12:32', '2025-05-24 23:05:13');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (17, 39, 2, 157246, 314492);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (17, 35, 3, 449903, 1349709);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (17, 33, 3, 260106, 780318);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (17, 32, 1, 130998, 130998);
UPDATE "Order" SET total_price = 2575517 WHERE order_id = 17;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time) VALUES (3, 5, 0, 'Jl. Ronggowarsito No. 92, Kota Administrasi Jakarta Pusat, LA 59715', 'on_delivery', '2025-08-11 17:16:54', '2025-10-28 19:39:10', '2025-11-02 09:47:09');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (18, 42, 2, 258138, 516276);
UPDATE "Order" SET total_price = 516276 WHERE order_id = 18;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at) VALUES (12, 4, 0, 'Jalan S. Parman No. 18, Tomohon, PA 87995', 'waiting_approval', '2025-04-03 03:13:56');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (19, 36, 1, 472962, 472962);
UPDATE "Order" SET total_price = 472962 WHERE order_id = 19;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time, received_at) VALUES (9, 4, 0, 'Gang S. Parman No. 223, Semarang, SU 80278', 'received', '2025-04-29 05:25:02', '2025-05-30 06:58:47', '2025-09-22 14:39:34', '2025-10-17 11:02:11');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (20, 39, 3, 157246, 471738);
UPDATE "Order" SET total_price = 471738 WHERE order_id = 20;
UPDATE Store SET balance = balance + 471738 WHERE store_id = 4;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time) VALUES (6, 5, 0, 'Gg. Jend. A. Yani No. 296, Sungai Penuh, LA 13376', 'on_delivery', '2025-09-02 01:27:13', '2025-11-07 22:14:58', '2025-11-19 15:35:20');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (21, 44, 2, 39537, 79074);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (21, 43, 2, 92204, 184408);
UPDATE "Order" SET total_price = 263482 WHERE order_id = 21;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time, received_at) VALUES (18, 5, 0, 'Jalan Kendalsari No. 4, Malang, RI 50434', 'received', '2025-08-15 17:27:39', '2025-10-05 22:03:25', '2025-10-20 14:58:45', '2025-11-10 01:29:06');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (22, 50, 1, 142946, 142946);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (22, 41, 1, 21287, 21287);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (22, 45, 3, 393481, 1180443);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (22, 48, 1, 355358, 355358);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (22, 48, 3, 355358, 1066074);
UPDATE "Order" SET total_price = 2766108 WHERE order_id = 22;
UPDATE Store SET balance = balance + 2766108 WHERE store_id = 5;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, reject_reason) VALUES (11, 2, 0, 'Jl. Kiaracondong No. 50, Banda Aceh, Bengkulu 90449', 'rejected', '2025-06-17 06:48:33', '2025-10-18 23:24:10', 'Cupiditate culpa ipsa aliquam.');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (23, 13, 2, 163157, 326314);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (23, 11, 3, 75249, 225747);
UPDATE "Order" SET total_price = 552061 WHERE order_id = 23;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, reject_reason) VALUES (9, 3, 0, 'Gang S. Parman No. 223, Semarang, SU 80278', 'rejected', '2025-08-25 09:21:55', '2025-10-10 18:52:30', 'Itaque impedit nihil mollitia.');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (24, 30, 1, 443117, 443117);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (24, 26, 3, 395109, 1185327);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (24, 25, 1, 31500, 31500);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (24, 26, 3, 395109, 1185327);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (24, 30, 3, 443117, 1329351);
UPDATE "Order" SET total_price = 4174622 WHERE order_id = 24;
INSERT INTO "Order" (buyer_id, store_id, total_price, shipping_address, status, created_at, confirmed_at, delivery_time) VALUES (12, 4, 0, 'Jalan S. Parman No. 18, Tomohon, PA 87995', 'on_delivery', '2025-11-02 21:42:37', '2025-11-05 22:16:09', '2025-11-16 15:35:27');
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (25, 33, 3, 260106, 780318);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (25, 40, 1, 132024, 132024);
INSERT INTO Order_Items (order_id, product_id, quantity, price_at_order, subtotal) VALUES (25, 33, 2, 260106, 520212);
UPDATE "Order" SET total_price = 1432554 WHERE order_id = 25;

INSERT INTO auctions (
  product_id, 
  seller_id, 
  starting_price, 
  current_price, 
  status, 
  start_time, 
  end_time,
  last_bid_time,
  created_at
) VALUES (
  1,                    -- Product: T-Shirt milik seller 21
  21,                   -- Seller: Wirda Palastri
  50000,                -- Starting price: Rp 50,000
  50000,                -- Current price: Rp 50,000 (belum ada bid)
  'active',             -- Status: active (siap di-bid)
  NOW() - INTERVAL '5 minutes',  -- Sudah start 5 menit lalu
  NOW() + INTERVAL '10 minutes', -- Akan end 10 menit lagi
  NOW(),                -- Last bid time: sekarang
  NOW()
);

--- 9. MEMBUAT INDEKS FTS ---
CREATE INDEX IF NOT EXISTS idx_product_search ON Product USING GIN (search_vector);

INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (NULL, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (NULL, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (NULL, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (1, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (1, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (1, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (2, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (2, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (2, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (3, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (3, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (3, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (4, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (4, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (4, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (5, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (5, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (5, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (6, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (6, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (6, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (7, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (7, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (7, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (8, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (8, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (8, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (9, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (9, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (9, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (10, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (10, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (10, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (11, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (11, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (11, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (12, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (12, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (12, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (13, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (13, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (13, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (14, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (14, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (14, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (15, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (15, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (15, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (16, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (16, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (16, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (17, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (17, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (17, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (18, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (18, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (18, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (19, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (19, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (19, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (20, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (20, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (20, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (21, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (21, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (21, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (22, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (22, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (22, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (23, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (23, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (23, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (24, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (24, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (24, 'auction_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (25, 'checkout_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (25, 'chat_enabled', TRUE, '...');
INSERT INTO feature_access (user_id, feature_name, is_enabled, reason) VALUES (25, 'auction_enabled', TRUE, '...');
