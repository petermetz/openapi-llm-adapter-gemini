'use strict';


/**
 * Retrieve the location of an IP address
 *
 * api_key String 
 * ip_address String  (optional)
 * fields String  (optional)
 * returns inline_response_200
 **/
exports.v1GET = function(api_key,ip_address,fields) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "continent" : "continent",
  "country" : "country",
  "flag" : {
    "emoji" : "emoji",
    "svg" : "svg",
    "png" : "png",
    "unicode" : "unicode"
  },
  "country_geoname_id" : 5,
  "city" : "city",
  "city_geoname_id" : 0,
  "country_is_eu" : true,
  "timezone" : {
    "name" : "name",
    "gmt_offset" : 9,
    "abbreviation" : "abbreviation",
    "current_time" : "current_time",
    "is_dst" : true
  },
  "latitude" : 5.637376656633329,
  "continent_code" : "continent_code",
  "ip_address" : "ip_address",
  "region_geoname_id" : 7,
  "region_iso_code" : "region_iso_code",
  "country_code" : "country_code",
  "security" : {
    "is_vpn" : true
  },
  "connection" : {
    "isp_name" : "isp_name",
    "connection_type" : "connection_type",
    "organization_name" : "organization_name",
    "autonomous_system_organization" : "autonomous_system_organization",
    "autonomous_system_number" : 6
  },
  "currency" : {
    "currency_name" : "currency_name",
    "currency_code" : "currency_code"
  },
  "continent_geoname_id" : 1,
  "postal_code" : "postal_code",
  "region" : "region",
  "longitude" : 2.3021358869347655
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

