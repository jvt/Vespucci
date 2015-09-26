var express = require('express');
var router = express.Router();

var ig = require('instagram-node').instagram();

/* GET popular locations given a LATITUDE / LONGITUDE */
router.get('/search/:LATITUDE/:LONGITUDE/', function(req, res, next) {
	var latitude = req.params.LATITUDE;
	var longitude = req.params.LONGITUDE;

	if (!latitude || !longitude) {
		res.send({ 'error': true, 'message': 'MISSING PARAMETER' });
	}
	
	if (isNaN(latitude) || isNaN(longitude)) {
		res.send({ 'error': true, 'message': 'PARAMETER NAN' });
	}
	res.send({'error': false});
});

module.exports = router;
