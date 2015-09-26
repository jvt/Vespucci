var express = require('express');
var router = express.Router();

var randomstring = require('randomstring');

var authSignature = require('oauth-signature');

var request = require('request');

var md5 = require('md5');

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
				'geocode': '"'+latitude+','+longitude+',2mi"',
				'count': 100
			};
			var signature = authSignature.generate('GET',
													config.get('twitter').FQDN + "search/tweets.json",
													parameters,
													config.get('twitter').consumer_secret,
													config.get('twitter').oauth_token_secret);
			var options = {
				url: config.get('twitter').FQDN + 'search/tweets.json?q='+query_search_term+'&geocode="'+latitude+','+longitude+',2mi"&count=100',
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
			var masterObject = [];

			for (var i in results['instagramLocations'])
			{
				var ig = results['instagramLocations'][i];
				var location = ig[0].location;
				
				// Create new popular location Object
				var popular = {};
				popular.uuid = md5(location.latitude + "," + location.longitude);
				popular.name = location.name;
				popular.instagram = [];
				popular.tweets = [];
				popular.foursquare = [];
				popular.location = {};

				// Basic spam checker (removes any object with name that contains .com/.net/.org)
				if (popular.name.indexOf('.com') > -1 || popular.name.indexOf('.net') > -1 || popular.name.indexOf('.org') > -1) {
					break;
				}

				// Populate popular location Object with instagram photos
				for (photoIndex in ig)
				{
					var photo = ig[photoIndex];

					if (!photo.location || photo.type != 'image') {
						break;
					}

					popular.location = photo.location;

					var photoData = {};
					photoData.location = photo.location;
					photoData.created_time = photo.created_time;
					photoData.link = photo.link;
					photoData.fullResImageData = photo.images.standard_resolution;
					photoData.caption = photo.caption;

					popular.instagram.push(photoData);
				}

				// Populate popular location Object with tweets
				for (tweetIndex in results['twitter']['statuses'])
				{
					var tweet = results['twitter']['statuses'][tweetIndex];
					
					// Remove from tweet object -- It's of little value to us
					if (tweet.geo == null) {
						results['twitter']['statuses'].splice(tweetIndex, 1);
					} else {
						// Compare lat/long
						var photoLat  = popular.location.latitude;
						var photoLong = popular.location.longitude;
						var tweetLat  = tweet.geo.coordinates[0];
						var tweetLong = tweet.geo.coordinates[1];

						if ((tweetLat > photoLat - .0009 && tweetLat < photoLat + .0009) && (tweetLong > photoLong - .0009 && tweetLong < photoLong + .0009)) {
							var tweetData = {};
							tweetData.text = tweet.text;
							tweetData.id = tweet.id;
							tweetData.created_at = tweet.created_at;
							tweetData.geo = tweet.geo;
							popular.tweets.push(tweetData);

							// Remove from tweet array now that we know where it belongs
							results['twitter']['statuses'].slice(tweetIndex, 1);
						}
					}

				}
				console.log(popular)
				masterObject.push(popular);
			}

			res.send(masterObject);
		}
	});
});

module.exports = router;
