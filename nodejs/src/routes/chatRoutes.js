const express = require('express');
const router = express.Router();
const { getChatRooms, getChatMessages, initiateChat } = require('../controllers/chatController');

const verifyJWT = require('../middleware/verifyJWTUser');
router.get('/chats',verifyJWT, getChatRooms);
router.get('/chats/:roomId/messages',verifyJWT, getChatMessages);
router.post('/chats/initiate',verifyJWT, initiateChat);

module.exports = router;