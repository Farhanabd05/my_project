import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useAuth } from '../context/AuthContext';
import FeatureNotFound from './FeatureNotFound';
import './Chat.css';

function Chat() {
  const { token, user, loading: authLoading } = useAuth();
  const [chatRooms, setChatRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [previewItem, setPreviewItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // REFS (Penyelamat Race Condition)
  const activeRoomRef = useRef(null); 
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const { socket, authenticated } = useChatWebSocket();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Sync Ref agar socket selalu tahu room aktif terbaru
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // 2. Ambil User ID & Fetch Rooms Awal
  useEffect(() => {
    if (token && user) {
        // Langsung fetch room tanpa perlu cari tahu userId lagi
        fetchChatRooms();
    }
  }, [token, user]); // Jalankan ulang jika token/user berubah

  const fetchChatRooms = async () => {
    try {
      const res = await fetch(`/api/node/chats`, {
        headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      const data = await res.json();
      if (data.success) {
        setChatRooms(data.data); // Load awal saja, jangan di-load terus menerus
      }
    } catch (err) { console.error(err); }
  };

  // 3. Auto Select Room dari URL (Logic Penjaga)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const roomIdFromUrl = searchParams.get('roomId');
    
    // Tangkap Preview Produk
    const productData = searchParams.get('previewProduct');
    if (productData) {
        try { 
            const parsed = JSON.parse(productData);
            setPreviewItem(parsed);
            
            // Hapus parameter agar bersih
            searchParams.delete('previewProduct');
            navigate(`?${searchParams.toString()}`, { replace: true });
            
        } catch (e) { /* Silent fail */ }
    }

    if (roomIdFromUrl && chatRooms.length > 0) {
      const targetId = parseInt(roomIdFromUrl);
      const targetRoom = chatRooms.find(r => parseInt(r.room_id) === targetId);
      
      if (targetRoom) {
          if (!activeRoom || parseInt(activeRoom.room_id) !== targetId) {
             handleRoomSelect(targetRoom);
          }
      }
    }
  }, [chatRooms, location.search, navigate]);

  // 4. Handle Ganti Room (Manual Click)
  const handleRoomSelect = (room) => {
    // Jangan lakukan apa-apa jika klik room yang sama
    if (activeRoom && activeRoom.room_id === room.room_id) return;

    setActiveRoom(room);
    setMessages([]); // Kosongkan layar
    
    // Ambil pesan
    fetchMessages(room.room_id);
    
    // Join Socket
    if (socket && authenticated) {
      socket.emit('join_room', room.room_id);
      socket.emit('mark_as_read', { roomId: room.room_id });
      
      // Update UI lokal biar badge hilang (tanpa fetch ulang)
      setChatRooms(prev => prev.map(r => 
        r.room_id === room.room_id ? { ...r, unread_count: 0 } : r
      ));
    }
  };

  const fetchMessages = async (roomId) => {
    try {
      if (!roomId) return;

      const res = await fetch(`/api/node/chats/${roomId}/messages`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
        scrollToBottom();
      }
    } catch (err) { console.error(err); }
  };

  // 5. SOCKET LISTENER (Jantung Chat)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (newMsg) => {
      const msgRoomId = parseInt(newMsg.room_id);
      
      // Cek room mana yang user LIHAT sekarang (pakai REF, bukan State)
      const currentActiveId = activeRoomRef.current ? parseInt(activeRoomRef.current.room_id) : null;
      const isViewing = msgRoomId === currentActiveId;

      // A. Jika sedang melihat room ini -> Tambah Bubble
      if (isViewing) {
        setMessages(prev => [...prev, newMsg]);
        scrollToBottom();
        socket.emit('mark_as_read', { roomId: msgRoomId });
      }

      // B. Update Sidebar (Tanpa Fetch Ulang API PHP)
      setChatRooms(prevRooms => {
        const roomIndex = prevRooms.findIndex(r => parseInt(r.room_id) === msgRoomId);
        if (roomIndex === -1) return prevRooms; // Room baru? abaikan dulu biar aman

        const updatedRooms = [...prevRooms];
        const targetRoom = { ...updatedRooms[roomIndex] };

        // Update Preview Text
        if (newMsg.message_type === 'image') targetRoom.last_message = '📷 Gambar';
        else if (newMsg.message_type === 'product') targetRoom.last_message = '📦 Produk';
        else targetRoom.last_message = newMsg.message_text;
        
        targetRoom.last_message_time = newMsg.created_at;

        // Update Badge jika tidak dilihat
        if (!isViewing) {
            targetRoom.unread_count = parseInt(targetRoom.unread_count || 0) + 1;
        } else {
            targetRoom.unread_count = 0;
        }

        updatedRooms[roomIndex] = targetRoom;
        
        return updatedRooms;
      });
    };

    socket.on('receive_message', handleReceiveMessage);

    // Re-join jika socket reconnect
    if (authenticated && activeRoomRef.current) {
        socket.emit('join_room', activeRoomRef.current.room_id);
    }

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, authenticated]); // Dependency minimal agar tidak restart-restart

  // 6. Handle Upload Gambar (Ke PHP)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    
    // [FIX 1] Reset value input agar event onChange bisa jalan lagi kalau user pilih file yang sama
    e.target.value = null; 

    if (!file) return;

    // [FIX 2] Validasi Ukuran di Client Dulu (Biar gak buang waktu upload kalau kegedean)
    if (file.size > 5 * 1024 * 1024) {
        alert("File terlalu besar! Maksimal 5MB.");
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    // Kasih feedback visual loading
    const attachBtn = document.querySelector('.btn-attach');
    const originalBtnContent = attachBtn.innerHTML;
    attachBtn.innerHTML = '⏳';
    attachBtn.disabled = true;

    try {
        const res = await fetch('/api/chat_upload.php', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            const payload = {
                roomId: activeRoom.room_id,
                senderId: user?.id,
                message: '',
                type: 'image',
                attachment: { url: data.url } 
            };
            socket.emit('send_message', payload);
        } else {
            console.error("Upload Error Detail:", data);
            alert('Upload gagal: ' + data.message);
        }
    } catch (err) { 
        console.error(err); 
        alert('Error koneksi upload'); 
    } finally {
        attachBtn.innerHTML = originalBtnContent;
        attachBtn.disabled = false;
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeRoom) return;

    const payload = {
      roomId: activeRoom.room_id,
      senderId: user?.id,
      message: inputMsg,
      type: 'text'
    };
    socket.emit('send_message', payload);
    setInputMsg('');
  };

  const sendProductPreview = () => {
      if (!previewItem || !activeRoom) return;
      socket.emit('send_message', {
          roomId: activeRoom.room_id,
          senderId: user?.id,
          message: `Produk: ${previewItem.name}`,
          type: 'product',
          attachment: previewItem
      });
      setPreviewItem(null);
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Render Helpers
  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '';
  const filteredRooms = chatRooms.filter(r => r.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [reason, setReason] = useState('');
  // 1. Efek untuk Redirect jika tidak ada user
  useEffect(() => {
    // Jika loading auth sudah selesai, TAPI token/user tidak ada
    if (!authLoading && !token) {
       // Redirect ke login PHP
       window.location.href = 'http://localhost:8082/login.php'; 
    }
  }, [authLoading, token]);
  useEffect(() => {
    // [GUARD] Jangan cek fitur kalau belum login (biar useEffect di atas kerja dulu)
    if (!token) return;
    const fetchFeature = async () => {
      try {
        const res = await fetch(`/api/node/features/chat_enabled`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFeatureEnabled(data.enabled);
        setReason(data.reason || '');
      } catch (err) {
        console.error('Feature check failed', err);
        setFeatureEnabled(false);
        setReason('Feature check failed');
      }
    };

    fetchFeature();
  }, [token]);

  if (authLoading || !token || featureEnabled === null) {
      return (
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
          <div className="skeleton-loader">Memuat Chat...</div>
        </div>
      );
  }
  if (!featureEnabled) {
    return <FeatureNotFound reason={reason}/>;
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
           <div className="search-container">
             <input type="text" placeholder="Cari chat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
        </div>
        <div className="room-list">
          {filteredRooms.map(room => (
            <div key={room.room_id} 
                 className={`room-card ${activeRoom?.room_id === room.room_id ? 'active' : ''}`}
                 onClick={() => handleRoomSelect(room)}>
                <div className="room-avatar">
                    {room.partner_image && room.partner_image !== 'placeholder.png' 
                        ? <img src={room.partner_image} onError={(e)=>e.target.style.display='none'} alt="avatar" /> 
                        : <span>{room.partner_name.charAt(0)}</span>
                    }
                </div>
                <div className="room-info">
                    <div className="room-top">
                        <span className="room-name">{room.partner_name}</span>
                        <span className="room-time">{formatTime(room.last_message_time)}</span>
                    </div>
                    <div className="room-bottom">
                        <span className="last-msg">{room.last_message}</span>
                        {parseInt(room.unread_count) > 0 && <span className="unread-badge">{room.unread_count}</span>}
                    </div>
                </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="chat-main">
        {!activeRoom ? (
          <div className="empty-state"><h3>Pilih percakapan</h3></div>
        ) : (
          <>
            <div className="chat-header"><h4>{activeRoom.partner_name}</h4></div>
            
            <div className="messages-container">
              {messages.map((msg, idx) => {
                const isMe = String(msg.sender_id) === String(user?.id);
                
                // Parsing attachment aman
                let attach = msg.attachment_info;
                if (typeof attach === 'string') {
                    try { attach = JSON.parse(attach); } catch(e){}
                }

                return (
                  <div key={idx} className={`message-wrapper ${isMe ? 'self' : 'other'}`}>
                    <div className={`chat-bubble ${isMe ? 'self' : 'other'}`}>
                      
                      {/* GAMBAR */}
                      {msg.message_type === 'image' && attach && (
                          <div className="msg-image-container">
                              <img src={attach.url} className="msg-image" alt="img" />
                          </div>
                      )}

                      {/* PRODUK */}
                      {msg.message_type === 'product' && attach && (
                          <a href={`/product_details.php?product_id=${attach.id}`} target="_blank" rel="noreferrer" className="product-card-bubble">
                              <img src={attach.image} style={{width:50, height:50, objectFit:'cover'}} alt={attach.name} />
                              <div>
                                  <div style={{fontWeight:'bold', fontSize:13}}>{attach.name}</div>
                                  <div style={{color:'green', fontSize:12}}>Rp {parseInt(attach.price).toLocaleString()}</div>
                              </div>
                          </a>
                      )}

                      {/* TEKS */}
                      {(msg.message_text || (!attach && msg.message_type === 'text')) && 
                        <div>{msg.message_text}</div>
                      }
                      
                      <div style={{fontSize:10, textAlign:'right', opacity:0.7, marginTop:4}}>
                        {formatTime(msg.created_at)} {isMe && '✓'}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Preview Bar */}
            {previewItem && (
                <div className="preview-bar">
                    <div className="preview-content">
                        <img src={previewItem.image} style={{width:50, height:50, objectFit:'cover', borderRadius:4}} alt={previewItem.name} />
                        <div className="preview-info">
                            <strong>{previewItem.name}</strong><br/>
                            <small>Kirim detail produk ke penjual?</small>
                        </div>
                    </div>
                    <div style={{display:'flex', gap:10}}>
                        <button className="btn-send-preview" onClick={sendProductPreview}>
                            Kirim
                        </button>
                        <button className="btn-cancel-preview" onClick={() => setPreviewItem(null)}>✕</button>
                    </div>
                </div>
            )}

            <form className="chat-input-container" onSubmit={handleSend}>
               <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileUpload} accept="image/*" />
               <button type="button" className="btn-attach" onClick={() => fileInputRef.current.click()}>📎</button>
               <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} placeholder="Tulis pesan..." />
               <button type="submit" className="btn-send">➤</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Chat;