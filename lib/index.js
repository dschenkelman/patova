'use strict';

const Boom = require('boom');
const Joi = require('joi');
const util = require('util');
const RateLimitHeaders = require('./rate_limit_headers');

const schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']),
  type: [Joi.string(), Joi.func()],
  limitd: Joi.object(),
  onError: Joi.func(),
  extractKey: Joi.func()
}).requiredKeys('type', 'event', 'limitd', 'extractKey');

function setResponseHeader({ response }, header, value) {
  if (!response) { return; }

  if (response.isBoom) {
    response.output.headers[header] = value;
  } else {
    response.header(header, value);
  }
}

function checkLimitsIfSet(request, h) {
  const requestLimit = request.plugins.patova && request.plugins.patova.limit;

  if (requestLimit && requestLimit.conformant){
    const headers = new RateLimitHeaders(
      requestLimit.limit,
      requestLimit.remaining,
      requestLimit.reset
    );

    Object
      .keys(headers)
      .forEach(key => setResponseHeader(request, key, headers[key]));
  }

  return h.continue;
}

function getMinimumLimit(limit1, limit2) {
  if (!limit1) { return limit2; }
  if (!limit2) { return limit1; }

  if (limit2.remaining > limit1.remaining) {
    return limit1;
  }

  return limit2;
}

function buildRateLimitEvent({ extractKey, limitd, onError, type }) {
  const flowControl = { continue: Symbol('CONTINUE') };

  async function getType(request) {
    if (typeof type !== 'function') {
      return type;
    }

    try {
      return await type(request, flowControl);
    } catch (err) {
      throw Boom.wrap(err, 500, 'cannot get bucket type');
    }
  }

  const takeAsync = limitd && util.promisify(limitd.take.bind(limitd));


  return async function onRateLimit(request, h) {
    if (!limitd) {
      // limitd is not connected, do not fail!
      return h.continue;
    }

    const bucketType = await getType(request);
    const key = await extractKey(request, flowControl);

    if (bucketType === flowControl.continue || key === flowControl.continue) {
      return h.continue;
    }

    let currentLimitResponse;

    try {
      currentLimitResponse = await takeAsync(bucketType, key);
    } catch (err) {
      if (onError) { return onError(err, h); }

      // by default we don't fail if limitd is unavailable
      return h.continue;
    }

    const oldMinimumLimitResponse = request.plugins.patova && request.plugins.patova.limit
    const newMinimumLimitResponse = getMinimumLimit(currentLimitResponse, oldMinimumLimitResponse)

    request.plugins.patova = request.plugins.patova || {};
    request.plugins.patova.limit = newMinimumLimitResponse;

    if (newMinimumLimitResponse.conformant) {
      // We continue only if the request is conformat so far
      return h.continue;
    }

    const error = Boom.tooManyRequests();
    error.output.headers = new RateLimitHeaders(
      newMinimumLimitResponse.limit,
      newMinimumLimitResponse.remaining,
      newMinimumLimitResponse.reset);

    throw error;
  }
}

async function register(server, options) {
  const {
    error, value: { event, ...rateLimitConfig }
  } = await Joi.validate(options, schema, { abortEarly: false });

  if (error) {
    throw error;
  }

  server.ext('onPreResponse', checkLimitsIfSet);
  server.ext(event, buildRateLimitEvent(rateLimitConfig));
}

module.exports = {
  pkg: require('../package.json'),
  register,
  multiple: true
};
