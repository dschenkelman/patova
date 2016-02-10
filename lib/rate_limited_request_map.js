'use strict';

function RateLimitedRequestMap() {
  this._requests = new Map();
}

/**
 * Keeps rate limited request which has the worse limit:
 *
 *  - If when this function is called there is a request with the same id as
 * `rlRequest.id`, it keeps the request with less remaining tokens and discard
 * the other one.
 *
 *  - If when this function is called there is not a request for `rlRequest.id`
 * it adds the given request.
 */
RateLimitedRequestMap.prototype.keepWorse = function keepWorse(rlRequest) {
  if (!rlRequest) { return; }

  const requestId = rlRequest.id;
  const old = this._requests.get(requestId);

  if (old && rlRequest.hasMoreRemainingThan(old)) { return old; }

  this._requests.set(requestId, rlRequest);

  return rlRequest;
};

RateLimitedRequestMap.prototype.get = function get(requestId) {
  return this._requests.get(requestId);
};

RateLimitedRequestMap.prototype.getAndRemove = function getAndRemove(requestId) {
  const rlRequest = this.get(requestId);
  this._requests.delete(requestId);

  return rlRequest;
};

module.exports = RateLimitedRequestMap;
