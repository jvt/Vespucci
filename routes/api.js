var express = require('express');
var router = express.Router();

var randomstring = require('randomstring');

var authSignature = require('oauth-signature');

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
			var query_search_term = "";
			var parameters = {
				'oauth_consumer_key': config.get('twitter').consumer_key,
				'oauth_nonce': randomstring.generate({charset: 'alphabetic'}),
				'oauth_signature_method': 'HMAC-SHA1',
				'oauth_timestamp': Math.floor(new Date() / 1000),
				'oauth_token': config.get('twitter').oauth_token,
				'oauth_version': '1.0',
				'q': query_search_term,
				'geocode': '"'+latitude+','+longitude+',2mi"'
			};
			var signature = authSignature.generate('GET',
													config.get('twitter').FQDN + "search/tweets.json",
													parameters,
													config.get('twitter').consumer_secret,
													config.get('twitter').oauth_token_secret);
			var options = {
				url: config.get('twitter').FQDN + 'search/tweets.json?q='+query_search_term+'&geocode="'+latitude+','+longitude+',2mi"',
				headers: {
					'Authorization': 'OAuth oauth_consumer_key="'+parameters['oauth_consumer_key']+'", oauth_nonce="'+parameters['oauth_nonce']+'", oauth_signature="'+signature+'", oauth_signature_method="'+parameters['oauth_signature_method']+'", oauth_timestamp="'+parameters['oauth_timestamp']+'", oauth_token="'+parameters['oauth_token']+'", oauth_version="'+parameters['oauth_version']+'"'
				}
			};
			request(options, function(error, response, body)
			{
				if (error) {
					callback(error, null);
				}
				if (body && response.statusCode == 200) {
					callback(null, JSON.parse(body))
				} else {
					callback(true, body)
				}
			});
		},
		foursquare: function(callback)
		{
			callback(null, null)
		}
	}, function(error, results)
	{
		if (error) {
			res.send({'error': true, 'message': error})
		} else {
			res.send(results)
		}
	});
});

module.exports = router;
