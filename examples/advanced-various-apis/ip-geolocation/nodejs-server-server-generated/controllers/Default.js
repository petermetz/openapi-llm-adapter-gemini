'use strict';

var utils = require('../utils/writer.js');
var Default = require('../service/DefaultService');

module.exports.v1GET = function v1GET (req, res, next, api_key, ip_address, fields) {
  Default.v1GET(api_key, ip_address, fields)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
