# php/Dockerfile

# Mulai dari image FPM yang sama
FROM php:8.3-fpm

# 1. Update list paket
# 2. Install library yang dibutuhkan:
#    - libpq-dev: Untuk driver pdo_pgsql
#    - libpng-dev, libjpeg62-turbo-dev, libfreetype6-dev: Untuk driver gd (gambar)
# 3. Hapus cache apt untuk jaga ukuran image
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Konfigurasi GD agar bisa pakai Freetype (font) dan JPEG
RUN docker-php-ext-configure gd --with-freetype --with-jpeg

RUN docker-php-ext-install pdo pdo_pgsql gd