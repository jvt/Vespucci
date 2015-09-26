var express = require('express');
var router = express.Router();

/* GET api listing. */
router.get('/search/:LOCATION_NAME', function(req, res, next) {
  res.send('will return JSON');
});

module.exports = router;
