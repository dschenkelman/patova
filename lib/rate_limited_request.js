'use strict';

const RateLimitHeaders = require('./rate_limit_headers');

function RateLimitedRequest(id, data) {
  this.id = id;
  this.remaining = data.remaining;
  this.conformant = data.conformant;
  this.responseHeaders = new RateLimitHeaders(data.limit, data.remaining, data.reset);
};

RateLimitedRequest.prototype.hasMoreRemainingThan = function(otherRlResponse) {
  return this.remaining > otherRlResponse.remaining;
};

RateLimitedRequest.prototype.isConformant = function() {
  return this.conformant;
};

RateLimitedRequest.prototype.getResponseHeaders = function() {
  return this.responseHeaders;
};

module.exports = RateLimitedRequest;
