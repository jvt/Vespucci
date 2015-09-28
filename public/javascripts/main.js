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

function initMap() {
	var startPoint = {
		lat: 33.783315,
		lng: -84.385
	};				  
	var map = instantiateMap(startPoint.lat, startPoint.lng);

	var update = startPoint.lng;
	var timerDelay = 800;
	var eventListen = false;

	panningEffect();

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

			$("#locationbutton").click(function() {
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
}

function gettext (url, callback) {
	var request = new XMLHttpRequest();
	request.onreadystatechange = function()
	{
		if (request.readyState == 4 && request.status == 200)
		{
			mycallback(request.responseText); // Another callback here
		}
	}; 
	request.open('GET', '/api/search/' + sourceLat + "/" + sourceLng);
	request.send();
}

//populate the map
function mycallback(data) {
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
			center: {lat: json[locationIndex].lat, lng:json[locationIndex].lng},
			radius: json[locationIndex].instagramScore * 20
		});

		var latitude = json[locationIndex].lat;
		var longitude = json[locationIndex].lng;
		var eventName = json[locationIndex].eventname;
		var instaLinks = [];
		if(json[locationIndex].instagramCount > 0) {
			instaLinks = json[locationIndex].instagram;
		}

		var instaLink = instaLinks[0];

		var address, phone, visitors;

		if (typeof (json[locationIndex].address) !== 'undefined') {
			address = json[locationIndex].address;
		} else {
			address = 'address: N/A';
		}

		if (typeof (json[locationIndex].phone) !== 'undefined') {
			phone = json[locationIndex].phone;
		} else {
			phone = 'phone: N/A';
		}

		if (typeof (json[locationIndex].visitors) !== 'undefined') {
			visitors = json[locationIndex].visitors;
		} else {
			visitors = 'N/A';
		}

		var link = encodeURI('https://maps.google.com?saddr=' + sourceLat + ',' + sourceLng + '&daddr=' + latitude + ',' + longitude);
		var contentString = 
		'<div class="container blurbContent">' +
		'<div id="siteNotice">' +
		'</div>' +
		'<div id="bodyContent">' +
		'<div class="top">' +
		'<div class ="leftDiv">' +
		'<h1 class="blurbHeader">' + 
							//Event name
							eventName +
							'</h1>' +
							'<p class="eventDesc">' +
								// Phone number
								phone + 
								'<br>' + 
								// Address
								address + 
								'</p>' +
								'<hr>' +
								'<p class="eventDesc">' + 
								'No. of visitors' +
								'</p>' +
								'<p class="visitValue">' +
							//No. of Visitors
							visitors +
							'</p>' +
							'</div>'+

							'<div class ="rightDiv">' +
							'<p class="eventDesc">Snap from the event</p>' +
							'<img id="instagram" width="150px" height="200px" src="' +
							//Instagram URL goes here
							instaLink+
							'"/>' +
							'</div>' +
							'</div>' +
							'<hr>' +
							'<div class="break"></div>' +
							'<div class="footer">' +
							'<a href="' +
							link +
							'" id="leggo"><button class="btn btn-success"> Let\'s Go!</button></a>' +
							'</div>' +
							'</div>'+
							'</div>';

							cityCircle.info = new google.maps.InfoWindow ({
			// content: 'swerve ' + latitude,
			content: contentString,
			maxWidth: 450,
			position: {lat: latitude, lng:longitude}
		});

		google.maps.event.addListener(cityCircle, 'click', function() {
			if (infowindow) infowindow.close();
			infowindow = this.info;
			this.info.open(map, this);
		});

		google.maps.Map.prototype.clearMarkers = function() {
			if (infowindow) {
				infowindow.close();
			}

			for(var i=0; i<this.markers.length; i++){
				this.markers[i].set_map(null);
			}
		};
	}
}	


function showArrays(event) {
	infoWindow.setContent('swerve');
	infoWindow.setPosition(event.latLng);
	infoWindow.open(map);
}

function loadJS(src, callback) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onreadystatechange = s.onload = function() {
        var state = s.readyState;
        if (!callback.done && (!state || /loaded|complete/.test(state))) {
            callback.done = true;
            callback();
        }
    };
    document.getElementsByTagName('head')[0].appendChild(s);
}

function init() {
	initMap();
	initAutocomplete();
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
		gettext(null, mycallback);
		animateTransition();
	});
}

// Button is clicked, sends lat and long based on your current location
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
			gettext(null, mycallback);
			animateTransition();
		});
	}
}

// Transition from front to main
function animateTransition() {
	$("#options").fadeOut('slow', function() {
		$("#mainlogo").fadeOut('slow', function() {
			$("#searchBar").css({
				"top": "-100px",
				"left": "50px"
			});
			$("#searchBar").fadeIn('slow');
			$("#headerbackground").css({
				"backgroundColor": "#AA4652"
			});
			$("#headercontent").css({
				"width": "90%"
			});
			$("#smalllogo").fadeIn('slow');

			$("#blur").css({
				"display": "none"
			})

			$("#back").css("display","none");
		});
	});
}

$("#searchbutton").click(function() {
	$("#options").fadeOut(function(){
		$("#searchBar").fadeIn('slow');
	});
});

/*
 * creates a map at a specified latitude and longitude
 */
function instantiateMap(alat, along) {
	var myLatLng = {lat: alat, lng: along};


	var styleArray = [
	{
		featureType: "all",
		stylers: [
		{ saturation: -100 }
		]
	},{
		featureType: "road.arterial",
		elementType: "geometry",
		stylers: [
		{ hue: "#00ffee" },
		{ saturation: 50 }
		]
	},{
		featureType: "poi.business",
		elementType: "labels",
		stylers: [
		{ visibility: "off" }
		]
	}
	];
	var mapOptions = {
		disableDefaultUI: true,
		disableDoubleClickZoom: true,
		scrollwheel: false,
		navigationControl: false,
		mapTypeControl: false,
		scaleControl: false,
		draggable: true,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		center: myLatLng,
		zoom: 14,
		styles: styleArray
	};
	map = new google.maps.Map(document.getElementById('map'), mapOptions);

	return map;
}

/*
 * latitude, longitude, sentiment, size. Creates a dot on the map
 */
function addMarker(currentLatLng, map, title) {
	var marker = new google.maps.Marker({
		position: currentLatLng,
		map: map,
		title: title
	});
	return marker;
}