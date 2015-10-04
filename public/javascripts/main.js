var globaljson, sourceLat, sourceLng, infowindow;
var maxNumberLocations = 10;

function instantiateMap(alat, along) {
	var myLatLng = {lat: alat, lng: along};
	var map = new google.maps.Map(document.getElementById('map'), {
		zoom: 14,
		center: myLatLng
	});
	return map;
}

/**
 * Initialize the map
 */ 
function initMap() {
	var startPoint = {
		lat: 33.783315,
		lng: -84.385
	};				  
	var map = instantiateMap(startPoint.lat, startPoint.lng);

	var update = startPoint.lng;
	var timerDelay = 800;
	var eventListen = false;

	/**
	 * Create animation on the background map on the homepage
	 */
	function panningEffect() {
		if (!eventListen) {
			update += Math.random() * (0.02 - 0.050) + 0.050;
			startPoint = {
				lat: 33.783315 + (Math.random() * (0.02 - 0.050) + 0.050),
				lng: update
			};
			map.panTo(startPoint);
			setTimeout(panningEffect, timerDelay);
			timerDelay += 800;

			$("#locationbutton").click(function(e) {
				e.preventDefault();
		  	Pace.restart();
				eventListen = true;
			});
			$("#autocomplete").focus(function() {
				eventListen = true;
				$(window).keydown(function(event){
					if(event.keyCode == 13) {
						event.preventDefault();
						return false;
					}
				});
			});
		}
	}
	panningEffect();  
}

function gettext (url, callback) {
	var request = new XMLHttpRequest();
	request.onreadystatechange = function()
	{
		if (request.readyState == 4 && request.status == 200)
		{
			populateMapWithDataPoints(request.responseText);
		}
	}; 
	request.open('GET', '/api/search/' + sourceLat + "/" + sourceLng);
	request.send();
}

function initAutocomplete() {
	autocomplete = new google.maps.places.Autocomplete((document.getElementById('autocomplete')), {
		types: ['geocode']
	});

	// When the user selects an address from the dropdown, populate the address, sends the lat long
	autocomplete.addListener('place_changed', function() {
		var place = autocomplete.getPlace().geometry.location;
		var lat = place.H;
		var lng = place.L;

		var currentLatLng = {
			lat: lat,
			lng: lng
		};

		map.panTo(currentLatLng);

		var marker = addMarker(currentLatLng, map, 'Your searched location');

		sourceLat = lat;
		sourceLng = lng;
		gettext(null, populateMapWithDataPoints);
		animateTransition();
	});
}

/**
 * Locate user's latitute/longitude
 */
function geolocate() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {
			var lat = position.coords.latitude;
			var lng = position.coords.longitude;

			var currentLatLng = {
				lat: lat,
				lng: lng
			};
			map.panTo(currentLatLng);

			var marker = addMarker(currentLatLng, map, 'Your current location');

			sourceLat = lat;
			sourceLng = lng;
			gettext(null, populateMapWithDataPoints);
			animateTransition();
		});
	}
}

/**
 * Creates a Google Maps marker on the map
 */
 function addMarker(currentLatLng, map, title) {
 	var marker = new google.maps.Marker({
 		position: currentLatLng,
 		map: map,
 		title: title
 	});
 	return marker;
 }

/**
 * Creates a map at a specified latitude and longitude
 */
 function instantiateMap(alat, along) {
 	var myLatLng = {lat: alat, lng: along};

 	var styleArray = [
	 	{
	 		featureType: "all",
	 		stylers: [
	 		{ saturation: -100 }
	 		]
	 	},
	 	{
	 		featureType: "road.arterial",
	 		elementType: "geometry",
	 		stylers: [
	 		{ hue: "#00ffee" },
	 		{ saturation: 50 }
	 		]
	 	},
	 	{
	    featureType: "poi",
	    elementType: "labels",
	    stylers: [
	      { visibility: "off" }
	    ]
	  },
	  {
		  featureType: 'transit.station',
		  elementType: 'all',
		  stylers: [
		  	{ visibility: 'off' }
		  ]
		}
 	];
 	var mapOptions = {
 		scrollwheel: true,
 		disableDoubleClickZoom: true,
 		disableDefaultUI: true,
 		mapTypeControl: false,
 		draggable: true,
 		mapTypeId: google.maps.MapTypeId.ROADMAP,
 		center: myLatLng,
 		zoom: 14,
 		styles: styleArray
 	};
 	map = new google.maps.Map(document.getElementById('map'), mapOptions);

 	return map;
 }

/**
 * Transition from homepage to main-map page
 */
function animateTransition() {
	$("#options").fadeOut('slow', function() {
		$("#mainlogo").fadeOut('slow', function() {
			$("#headerbackground").css({
				"backgroundColor": "#AA4652"
			});
			$("#searchBar").css({
				"float": "right",
				"top": "-100px"
			});
			$("#searchBar").fadeIn('slow');
			$("#headercontent").css({
				"width": "90%"
			});
			$("#smalllogo").fadeIn('slow');

			$("#blur").css({
				"display": "none"
			});
			$("#back").css({
				"display": "none"
			});
		});
	});
}

$("#searchbutton").click(function() {
	$("#options").fadeOut(function(){
		$("#searchBar").fadeIn('slow');
	});
});

/**
 * Given a set of data points, add them to the map with the corresponding circle data
 */
function populateMapWithDataPoints(data) {
	var json = $.parseJSON(data).blurbData;

	for (locationIndex in json) {
		latitude = json[locationIndex].lat;
		longitude = json[locationIndex].lng;

		cityCircle = new google.maps.Circle({
			strokeColor: '#FF0000',
			strokeOpacity: 0.8,
			strokeWeight: 2,
			fillColor: '#FF0000',
			fillOpacity: 0.35,
			map: map,			  		
			center: {
				lat: json[locationIndex].lat,
				lng:json[locationIndex].lng
			},
			radius: json[locationIndex].instagramScore * 20
		});

		var latitude = json[locationIndex].lat;
		var longitude = json[locationIndex].lng;
		var eventName = json[locationIndex].eventname;
		var instaLink = "";
		if (json[locationIndex].instagram.length > 0) {
			instaLink = json[locationIndex].instagram[Math.floor(Math.random() * json[locationIndex].instagram.length)];
		}

		var address, phone, visitors;

		if (typeof (json[locationIndex].address) !== 'undefined') {
			address = json[locationIndex].address;
		} else {
			address = 'Address: N/A';
		}

		if (typeof (json[locationIndex].phone) !== 'undefined') {
			phone = json[locationIndex].phone;
		} else {
			phone = 'Phone: N/A';
		}

		if (typeof (json[locationIndex].visitors) !== 'undefined') {
			visitors = json[locationIndex].visitors;
		} else {
			visitors = 'N/A';
		}

		var link = encodeURI('https://maps.google.com?saddr=' + sourceLat + ',' + sourceLng + '&daddr=' + latitude + ',' + longitude);

		var contentString = 
						'<div class="container iw-container">' +
						'<div class="iw-content">' +
						'<div class="topBlurb">' +
						'<div class ="leftDiv">' +
						'<h1 class="blurbHeader">' + 
				      	eventName +
				      	'</h1>' +
				      	'<p class="eventDesc">' +
			      		phone + 
			      		'<br>' + 
			      		address + 
			      		'</p>' +
			      		'<hr>' +
			      		'<p class="eventDesc">' + 
			      		'No. of visitors' +
			      		'</p>' +
			      		'<p class="visitValue">' +
				      	visitors +
				      	'</p>' +
				      	'</div>'+
				      	'<div class ="rightDiv">' +
				      	'<p class="eventDesc">Instagram from the event</p>' +
				      	'<img id="instagram" width="150px" height="200px" src="' +
						instaLink+
						'"/>' +
						'</div>' +
						'</div>' +
						'<div class="break"></div>' +
						'<hr>' +
						'<div class="footer">' +
						'<a href="' +
						link +
						'" id="leggo"><button class="btn btn-success"> Let\'s Go!</button></a>' +
						'</div>' +
						'</div>'+
						'</div>';

		cityCircle.info = new google.maps.InfoWindow({
	  		content: contentString,
	  		maxWidth: 450,
	  		position: {lat: latitude, lng:longitude}
	  	});

		google.maps.event.addListener(cityCircle, 'mouseover', function() {
			if (infowindow) infowindow.close();
			infowindow = this.info;
			this.info.open(map, this);
		});

		google.maps.Map.prototype.clearMarkers = function() {
			if(infowindow) {
				infowindow.close();
			}

			for(var i=0; i<this.markers.length; i++) {
				this.markers[i].set_map(null);
			}
		};
	}
}

/**
 * Master initializer function
 */
function initializer() {
	initMap();
	initAutocomplete();
}
