var express = require('express');
var router = express.Router();

var randomstring = require('randomstring');

var authSignature = require('oauth-signature');

var request = require('request');

var md5 = require('md5');

var async = require('async');

var ig = require('instagram-node').instagram();

var forEach = require('async-foreach').forEach;

var _ = require('underscore');

/* GET popular locations given a LATITUDE / LONGITUDE */
router.get('/search/:LATITUDE/:LONGITUDE/', function(req, res, next) {
	var latitude = req.params.LATITUDE;
	var longitude = req.params.LONGITUDE;

	if (!latitude || !longitude) {
		res.json({ 'error': true, 'message': 'MISSING PARAMETER' });
	}

	if (isNaN(latitude) || isNaN(longitude)) {
		res.json({ 'error': true, 'message': 'PARAMETER NaN' });
	}

	function sortInstagram(unsorted, callback)
	{
		var locations = {};
		forEach(unsorted, function(image, result, array) {
			var imageLocationID = unsorted[result].location.id;
			if (locations[imageLocationID]) {
				locations[imageLocationID].push(unsorted[result]);
			} else {
				locations[imageLocationID] = [unsorted[result]];
			}
		}, function(notAborted, array)
		{
			callback(locations);
		});
	}

	function pushIntoArray(toBeExploded, toBePushed, callback)
	{
		var newArray = toBePushed;
		forEach(toBeExploded, function(exploded, index)
		{
			newArray.push(exploded);
		}, function(notAborted, array)
		{
			callback(newArray);
		});
	}

	function loadInstagramPhotos(MAX_TIMESTAMP, callback)
	{
		var url;
		if (MAX_TIMESTAMP) {
			url = config.get('instagram').FQDN + '?distance=5000&max_timestamp='+MAX_TIMESTAMP+'&access_token=' + config.get('instagram').access_token + '&lat=' + latitude + '&lng=' + longitude;
		} else {
			url = config.get('instagram').FQDN + '?distance=5000&access_token=' + config.get('instagram').access_token + '&lat=' + latitude + '&lng=' + longitude;
		}
		request(url, function(error, response, body)
		{
			if (error) {
				callback(error, null);
			}
			if (body && response.statusCode == 200) {
				var results = JSON.parse(body);
				callback(null, results);						
			} else {
				callback('Error contacting Instagram API', null);
			}
		});
	}

	async.parallel({
		instagramLocations: function(callback)
		{
			var start = new Date();
			start.setHours(start.getHours-4);
			start = start / 1000;
			var url = config.get('instagram').FQDN + '?distance=5000&MIN_TIMESTAMP='+start+'&access_token=' + config.get('instagram').access_token + '&lat=' + latitude + '&lng=' + longitude;
			var rawUnsorted = [];
			var iterations = 5;
			function instagramify(MAX_TIMESTAMP, callback)
			{
				loadInstagramPhotos(MAX_TIMESTAMP, function(error, results)
				{
					if (error) {
						console.error(error);
					}
					pushIntoArray(results.data, rawUnsorted, function(newResult) {
						rawUnsorted = newResult;
						callback();
					});
				});
			}
			forEach(_.range(5), function(item, index)
			{
				var done = this.async();
				var iteration = null;
				if (index > 0) {
					iterationIndex = (index*20)-1;
					if (rawUnsorted[iterationIndex]) {
						iteration = rawUnsorted[iterationIndex].created_time;
					} else {
						iteration = null;
					}
				}
				if ((index > 0 && iteration != null) || index == 0 ) {
					instagramify(iteration, function()
					{
						done();
					});
				} else {
					done();
				}
			}, function(notAborted, array)
			{
				sortInstagram(rawUnsorted, function(newlySorted)
				{
					callback(null, newlySorted);	
				})
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
		}
	}, function(error, results)
	{
		if (error) {
			res.send({'error': true, 'message': error})
		} else {
			var masterObject = [];

			// Get Sentiment First
			forEach(results['twitter']['statuses'], function(tweet, tweetIndex, array)
			{
				// Calculate sentiment
				// var sentimentURL = config.get('alchemy').Endpoint + "?outputMode=json&apikey=" + config.get('alchemy').API_KEY + "&text=" + results['twitter']['statuses'][tweetIndex].text;
				// request(sentimentURL, function(err, response, body)
				// {
				// 	if (err) {
				// 		console.log(err);
				// 	}

				// 	if (body && response.statusCode == 200) {
				// 		var doc = JSON.parse(body);
				// 		if (doc.status == "OK") {
				// 			var docSentiment = doc.docSentiment;
				// 			var sentiment = 0;
				// 			if (docSentiment.score) {
				// 				sentiment = docSentiment.score;
				// 			}
				// 			results['twitter']['statuses'][tweetIndex].sentiment = sentiment;
				// 		} else {
				// 			if (results['twitter']['statuses'][tweetIndex] != undefined) {
				// 				results['twitter']['statuses'][tweetIndex].sentiment = null;
				// 			}
				// 		}
				// 	} else {
				// 		if (results['twitter']['statuses'][tweetIndex] != undefined) {
				// 			results['twitter']['statuses'][tweetIndex].sentiment = null;
				// 		}
				// 	}
				// });
			}, function(notAborted, array)
			{
				function getFoursquareInformation(name, latitude, longitude, callback)
				{
					var url = config.get('foursquare').FQDN + 'venues/search?query='+ name +'&ll=' + latitude + ',' + longitude + '&intent=match&client_id='+ config.get('foursquare').client_id +'&client_secret=' + config.get('foursquare').client_secret + '&v=20140806';
					request(url, function(error, response, body)
					{
						if (error) {
							callback(error, null);
						}
						var fs = JSON.parse(body);
						var v = fs.response['venues'];
						if (v.length > 0) {
							callback(null, v[0])
						} else {
							callback(null, {});
						}
					});
				}
				console.log(Object.keys(results['instagramLocations']))
				console.log(_.range(Object.keys(results['instagramLocations']).length))
				forEach(_.range(Object.keys(results['instagramLocations']).length), function(object, index)
				{
					var i = Object.keys(results['instagramLocations'])[index]
					console.log(i)

					var ig = results['instagramLocations'][i.toString()];
					var location = ig[0].location;
					
					// Create new popular location Object
					var popular = {};
					popular.uuid = md5(location.latitude + "," + location.longitude);
					popular.name = location.name;
					popular.instagram = [];
					popular.tweets = [];
					popular.foursquare = {};
					popular.location = {};

					console.log(location.name)

					// Basic spam checker (removes any object with name that contains .com/.net/.org)
					if (popular.name.indexOf('.com') > -1 || popular.name.indexOf('.net') > -1 || popular.name.indexOf('.org') > -1) {
						return;
					}

					// Populate popular location Object with instagram photos
					for (photoIndex in ig)
					{
						var photo = ig[photoIndex];

						if (!photo.location || photo.type != 'image') {
							return;
						}

						popular.loc = photo.location;

						var photoData = {};
						photoData.loc = photo.location;
						photoData.created_time = photo.created_time;
						photoData.link = photo.link;
						photoData.fullResImageData = photo.images.standard_resolution;
						photoData.caption = photo.caption;

						popular.instagram.push(photoData);
					}

					forEach(results['twitter']['statuses'], function (item, tweetIndex, array)
					{
						var tweet = results['twitter']['statuses'][tweetIndex];

						if (tweet) {

							// Remove from tweet object -- It's of little value to us
							if (tweet.geo == null) {
								results['twitter']['statuses'].splice(tweetIndex, 1);
							} else {
								// Compare lat/long
								var photoLat  = popular.location.latitude;
								var photoLong = popular.location.longitude;
								var tweetLat  = tweet.geo.coordinates[0];
								var tweetLong = tweet.geo.coordinates[1];

								if ((tweetLat > photoLat - .001 && tweetLat < photoLat + .001) && (tweetLong > photoLong - .001 && tweetLong < photoLong + .001)) {
									var tweetData = {};
									tweetData.text = tweet.text;
									tweetData.id = tweet.id;
									tweetData.created_at = tweet.created_at;
									tweetData.geo = tweet.geo;

									// Remove from tweet array now that we know where it belongs
									results['twitter']['statuses'].slice(tweetIndex, 1);

									popular.tweets.push(tweetData);
									
								}
							}
						}
					});
					var done = this.async();
					async.parallel({
						foursquare: function(callback)
						{
							getFoursquareInformation(location.name, location.latitude, location.longitude, function(error, results)
							{
								callback(null, results);
							});
						},
						twitter: function(callback)
						{
							callback(null, {});
						}
					}, function(error, results)
					{
						popular.tweets = results['twitter'];
						popular.foursquare = results['foursquare'];
						console.log(results);
						masterObject.push(popular);
						done()
					});
				}, function(notAborted, array)
				{
					res.json(masterObject);
				});
			});
		}
	});
});

/* GET popular locations given a LATITUDE / LONGITUDE */
router.get('/event/:LATITUDE/:LONGITUDE/:NAME/', function(req, res, next) {

	var latitude = req.params.LATITUDE;
	var longitude = req.params.LONGITUDE;
	var name = req.params.NAME;

	if (!latitude || !longitude || !name) {
		res.json({ 'error': true, 'message': 'MISSING PARAMETER' });
	}

	if (isNaN(latitude) || isNaN(longitude)) {
		res.json({ 'error': true, 'message': 'PARAMETER NaN' });
	}

	res.json({'data': 'THERE WILL BE SOMETHING HERE EVENTUALLY'});
});
module.exports = router;
