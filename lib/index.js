'use strict';

const Boom = require('boom');
const Joi = require('joi');
const RateLimitHeaders = require('./rate_limit_headers');

const schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']),
  type: [Joi.string(), Joi.func()],
  limitd: Joi.object(),
  onError: Joi.func(),
  extractKey: Joi.func()
}).requiredKeys('type', 'event', 'limitd', 'extractKey');

function setResponseHeader(request, header, value) {
  if (!request.response) { return; }

  if (request.response.isBoom) {
    request.response.output.headers[header] = value;
  } else {
    request.response.header(header, value);
  }
}

function setupPreResponseExt(server, options) {
  server.ext('onPreResponse', (request, h) => {
    const requestLimit = request.plugins.patova && request.plugins.patova.limit;

    if (requestLimit && requestLimit.conformant){
      const headers = new RateLimitHeaders(
          requestLimit.limit,
          requestLimit.remaining,
          requestLimit.reset);

      Object.keys(headers).forEach(
        key => setResponseHeader(request, key, headers[key]));
    }
    h.continue();
  });
}

function getMinimumLimit(limit1, limit2) {
  if (!limit1) { return limit2; }
  if (!limit2) { return limit1; }

  if (limit1 && limit2.remaining > limit1.remaining) {
    return limit1;
  }

  return limit2;
}

function setupRateLimitEventExt(server, options) {
  const event = options.event;
  const extractKey = options.extractKey;
  const onError = options.onError;

  const extractKeyAndTakeToken = async function(limitd, request, handler, type) {
    const key = extractKey(request, handler);
    if (err) { return err; }

    if (!limitd) {
      // limitd is not connected, do not fail!
      return handler.continue;
    }

    try {
      const currentLimitResponse = await limitd.take(type, key);

    } catch(err) {
      if (onError) { return onError(err, reply); }
      // by default we don't fail if limitd is unavailable
      return handler.continue;
    }


    const oldMinimumLimitResponse = request.plugins.patova && request.plugins.patova.limit
    const newMinimumLimitResponse = getMinimumLimit(currentLimitResponse, oldMinimumLimitResponse)

    request.plugins.patova = request.plugins.patova || {};
    request.plugins.patova.limit = newMinimumLimitResponse;

    if (newMinimumLimitResponse.conformant) {
      // We continue only if the request is conformat so far
      return handler.continue;
    }

    const error = Boom.tooManyRequests();
    error.output.headers = new RateLimitHeaders(
      newMinimumLimitResponse.limit,
      newMinimumLimitResponse.remaining,
      newMinimumLimitResponse.reset);

    throw error;
  };

  const getType = async function(request, handler, callback) {
    const type = options.type;

    if (typeof type !== 'function') {
      return process.nextTick(() => Promise.resolve(type));
    }

    try {
      return type(request);
    } catch (err) {
      return reply(Boom.wrap(err, 500, 'cannot get bucket type'));
    }
  };

  server.ext(event, async (request, handler) => {
    // This handler is going to be called one time per registration of patova
    const type = await getType(request, reply);
    extractKeyAndTakeToken(options.limitd, request, handler, type);
  });
}

async function register(server, options) {
  try {
    const processedOptions = await Joi.validate(options, schema, { abortEarly: false });
    setupRateLimitEventExt(server, processedOptions);
    setupPreResponseExt(server, processedOptions);
    return
  } catch(e) {
    return e;
  }
};

module.exports = {
  pkg: require('../package.json'),
  register,
  multiple: true
};
