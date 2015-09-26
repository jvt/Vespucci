var express = require('express');
var router = express.Router();

var request = require('request');

var async = require('async');

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

	async.parallel({
		instagramLocations: function(callback)
		{
			var url = config.get('instagram').FQDN + '?distance=5000&access_token=' + config.get('instagram').access_token + '&lat=' + latitude + '&lng=' + longitude;
			request(url, function(error, response, body)
			{
				if (error) {
					callback(error, null);
				}
				console.log(response)
				if (body && response.statusCode == 200) {
					var results = JSON.parse(body).data;

					var locations = {};

					for (result in results) {
						var imageLocationID = results[result].location.id;
						if (locations[imageLocationID]) {
							locations[imageLocationID].push(results[result]);
						} else {
							locations[imageLocationID] = [results[result]];
						}
					}

					callback(null, locations);
				} else {
					callback(true, 'Error contacting Instagram API');
				}
			});
		},
		twitter: function(callback)
		{
			callback(null, null);
		}
	}, function(error, results)
	{
		if (error) {
			res.send({'error': true, 'message': error})
		}
		res.send(results)
	});
});

module.exports = router;
