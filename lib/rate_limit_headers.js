'use strict';

function RateLimitHeaders(limit, remaining, reset){
  this['X-RateLimit-Limit'] = limit;
  this['X-RateLimit-Remaining'] = remaining;
  this['X-RateLimit-Reset'] = reset;
};

module.exports = RateLimitHeaders;
