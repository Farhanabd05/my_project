<?php

        function sendNotificationToNode($userId, $title, $message, $url = '/', $type = 'general') {
    // Alamat service nodejs di docker compose
    $nodeUrl = 'http://nodejs:3001/internal/send-notification';
    
    $data = json_encode([
        'userId' => $userId,
        'title' => $title,
        'message' => $message,
        'url' => $url,
        'type' => $type // Kirim tipe ke Node.js
    ]);
    
    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => $data,
            'ignore_errors' => true,
            'timeout' => 2 // Timeout cepat agar PHP tidak menunggu lama
        ]
    ];
    
    $context  = stream_context_create($options);
    // @ untuk suppress error jika Node.js mati, agar order tetap jalan
    @file_get_contents($nodeUrl, false, $context);
}
?>