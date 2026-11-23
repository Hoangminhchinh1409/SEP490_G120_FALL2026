const express = require('express');
const router = express.Router();
const routingController = require('../controllers/routingController');

// Proxy bản đồ, tìm kiếm địa chỉ & tính tuyến đường VietMap v4 qua Back-end để bảo mật API keys
router.get('/road-route', routingController.calculateRoadRoute);
router.get('/autocomplete', routingController.autocompletePlaces);
router.get('/search', routingController.searchPlaces);
router.get('/place', routingController.getPlaceDetails);
router.get('/tile/:z/:x/:y', routingController.proxyVietmapTile);

module.exports = router;
