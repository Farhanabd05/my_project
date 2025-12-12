const express = require('express');
const router = express.Router();
const { getAuctions, getAuctionById, cancelAuction } = require('../controllers/auctionController');

const verifyJWT = require('../middleware/verifyJWTUser');
router.get('/auctions', verifyJWT, getAuctions);
router.get('/auctions/:id', verifyJWT, getAuctionById);
router.post('/auctions/:id/cancel', verifyJWT, cancelAuction);

module.exports = router;