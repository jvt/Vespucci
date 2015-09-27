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

	/**
	 * name: sortInstagram
	 * parameters:
	 * 		@unsorted: Array
	 * 		@callback: Function
	 * return: none
	 * description: Sorts an array of Instagram photos by their location IDs
	 */
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

	/**
	 * name: pushIntoArray
	 * parameters:
	 * 		@toBeExploded: Array
	 *		@toBePushed: Array
	 * 		@callback: Function
	 * return: none
	 * description: Pushes all objects in the toBeExploded array into the toBePushed array
	 */
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

	/**
	 * name: loadInstagramPhotos
	 * parameters:
	 * 		@MAX_TIMESTAMP: Integer
	 * 		@callback: Function
	 * return: none
	 * description: Retrieves 20 Instagram photos. Uses MAX_TIMESTAMP to psuedo-paginate
	 */
	function loadInstagramPhotos(MAX_TIMESTAMP, callback)
	{
		var url;
		if (MAX_TIMESTAMP) {
			url = process.env.ig_fqdn + '?distance=5000&max_timestamp=' + MAX_TIMESTAMP + '&access_token=' + process.env.ig_access_token + '&lat=' + latitude + '&lng=' + longitude;
		} else {
			url = process.env.ig_fqdn + '?distance=5000&access_token=' + process.env.ig_access_token + '&lat=' + latitude + '&lng=' + longitude;
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

	/**
	 * name: loadInstagramPhotos
	 * parameters:
	 * 		@obj: Object
	 * return: None
	 * description: Organizes data to be used in the content-blurbs 
	 */
	function makeLocation(obj, callback)
	{
		var instalinks = [];
		var instagramScore = 0;
		var instagramCount = obj.instagram.length;

		for (var insta in obj.instagram)
		{
			instalinks.push(obj.instagram[insta].link);
			instagramScore += 2;
		}

		// Create location object
		var location = {};

		location.lat = obj.loc.latitude;
		location.lng = obj.loc.longitude;
		location.eventname = obj.loc.name;
		location.instagram = instalinks;
		location.instagramCount = instagramCount;
		location.instagramScore = instagramScore;

		if (obj.foursquare) {
			if (obj.foursquare.location) {
				location.address = obj.foursquare.location.formattedAddress[0];
			}
			if (obj.foursquare.contact) {
				location.phone = obj.foursquare.contact.formattedPhone;
			}
			if (obj.foursquare.stats) {
				location.visitors = obj.foursquare.stats.checkinsCount;
			}
		}
		location.placename = obj.foursquare.name;
		callback(location);
	}

	/**
	 * name: getFoursquareInformation
	 * parameters:
	 * 		@name: String
	 * 		@latitude: Float
	 *		@longitude: Float
	 * 		@callback: Function
	 * return: none
	 * description: Retrieves Foursquare's data for a specific place based on the name/latitute/longitude
	 */
	function getFoursquareInformation(name, latitude, longitude, callback)
	{
		var url = process.env.fs_fqdn + 'venues/search?query='+ name +'&ll=' + latitude + ',' + longitude + '&intent=match&client_id='+ process.env.fs_client_id +'&client_secret=' + process.env.fs_client_secret + '&v=20140806';
		request(url, function(error, response, body)
		{
			if (error || !body) {
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

	/**
	 * name: calulateTop
	 * parameters:
	 * 		@container: Contains all Instagram/Twitter data
	 * 		@callback: Function
	 * return: none
	 * description: Calculates the top number of locations
	 */
	function calculateTop(container, callback)
	{
		const numberOfResults = 10;
		var hashTable = {};
		var topUUIDs = [];
		var topLocations = [];

		/**
		 * Calculate scores
		 */
		for (var testCaseIndex in container) {
			var score = 0;
			var testCase = container[testCaseIndex];
			var UUID = testCase.uuid;
			score += (testCase.tweets.length) * 1; // Tweets count as 1 factor
			score += (testCase.instagram.length) * 2; // Instagrams count as 2 factors

			hashTable[UUID] = score;
		}

		for(var i = 0 ; i < numberOfResults ; i++)
		{
			var largestScore = -1;
			var largestKey = "";
			for (var uuid in hashTable)
			{
				var score = hashTable[uuid];
				if (score > largestScore && !topUUIDs[uuid]) {
					largestScore = hashTable[uuid];
					largestKey = uuid;
				}
			}
			topUUIDs[largestKey] = largestScore;
			delete hashTable.largestKey;
		}

		for (var UUID in topUUIDs)
		{
			for (var obj in container)
			{
				if (container[obj].uuid == UUID) {
					topLocations.push(container[obj]);
				}
			}
		}
		callback(topLocations);
	}

	async.parallel({
		instagramLocations: function(callback)
		{
			var start = new Date();
			start.setHours(start.getHours-4);
			start = start / 1000;
			var url = process.env.ig_fqdn+ '?distance=5000&MIN_TIMESTAMP=' + start + '&access_token=' + process.env.ig_access_token + '&lat=' + latitude + '&lng=' + longitude;
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
				});
			});
		},
		twitter: function(callback)
		{
			var query_search_term = "";
			var parameters = {
				'oauth_consumer_key': process.env.twitter_consumer_key,
				'oauth_nonce': randomstring.generate({charset: 'alphabetic'}),
				'oauth_signature_method': 'HMAC-SHA1',
				'oauth_timestamp': Math.floor(new Date() / 1000),
				'oauth_token': process.env.twitter_oauth_token,
				'oauth_version': '1.0',
				'q': query_search_term,
				'geocode': '"'+latitude+','+longitude+',2mi"',
				'count': 100
			};
			/**
			 * Generate OAuth signature
			 */
			var signature = authSignature.generate('GET',
													process.env.twitter_fqdn + "search/tweets.json",
													parameters,
													process.env.twitter_consumer_secret,
													process.env.twitter_oauth_token_secret);
			var options = {
				url: process.env.twitter_fqdn + 'search/tweets.json?q='+query_search_term+'&geocode="'+latitude+','+longitude+',2mi"&count=100',
				headers: {
					'Authorization': 'OAuth oauth_consumer_key="'+parameters['oauth_consumer_key']+'", oauth_nonce="'+parameters['oauth_nonce']+'", oauth_signature="'+signature+'", oauth_signature_method="'+parameters['oauth_signature_method']+'", oauth_timestamp="'+parameters['oauth_timestamp']+'", oauth_token="'+parameters['oauth_token']+'", oauth_version="'+parameters['oauth_version']+'"'
				}
			};
			/**
			 * Make API request to Twitter
			 */
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

			/**
			 * Iterate through the instagramLocations object and create a new object by the key
			 */
			forEach(_.range(Object.keys(results['instagramLocations']).length), function(object, index)
			{
				var i = Object.keys(results['instagramLocations'])[index]

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

				/**
				 * Force section to run async
				 */
				var done = this.async();
				async.parallel({
					twitter: function(callback)
					{
						var locationTweets = [];
						forEach(results['twitter']['statuses'], function (item, tweetIndex, array)
						{
							var tweet = results['twitter']['statuses'][tweetIndex];
							if (tweet) {
								// Remove from tweet object -- It's of little value to us
								if (tweet.geo == null) {
									results['twitter']['statuses'].splice(tweetIndex, 1);
								} else {
									// Compare lat/long
									var photoLat  = popular.loc.latitude;
									var photoLong = popular.loc.longitude;
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

										locationTweets.push(tweetData);	
									}
								}
							}
						}, function(notAborted, array)
						{
							callback(null, locationTweets);
						});
					}
				}, function(error, results)
				{
					/**
					 * Append to popular object
					 */
					popular.tweets = results['twitter'];

					/**
					 * Push now-filled object into master array
					 */
					masterObject.push(popular);

					done();
				});
			}, function(notAborted, array)
			{
				calculateTop(masterObject, function(topLocations)
				{
					async.times(topLocations.length, function(n, next)
					{
						getFoursquareInformation(topLocations[n].name, topLocations[n].loc.latitude, topLocations[n].loc.longitude, function(error, fs)
						{
							if (!error) {
								topLocations[n].foursquare = fs;
								next(null, fs);
							}
						});
					}, function (err, results)
					{
						var containmentObject = {
							"masterData": masterObject,
							"blurbData": []
						}
						forEach(masterObject, function(subArray, index)
						{
							makeLocation(subArray, function(locationData)
							{
								containmentObject.blurbData.push(locationData);
							});
						}, function(notAborted2, array2)
						{
							res.json(containmentObject);
						});
					});
				});
			});
		}
	});
});

module.exports = router;
