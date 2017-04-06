'use strict';

const Boom = require('boom');
const Joi = require('joi');
const RateLimitedRequest = require('./rate_limited_request');
const RateLimitedRequestMap = require('./rate_limited_request_map');

const pendingRequests = new RateLimitedRequestMap();

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

function setupPreResponseExt(server) {
  server.ext('onPreResponse', (request, reply) => {
    const rlRequest = pendingRequests.getAndRemove(request.id);

    if (rlRequest && rlRequest.isConformant()){
      const headers = rlRequest.getResponseHeaders();

      Object.keys(headers).forEach(
        key => setResponseHeader(request, key, headers[key]));
    }
    reply.continue();
  });
}

function setupRateLimitEventExt(server, options) {
  const event = options.event;
  const type = options.type;
  const extractKey = options.extractKey;
  const onError = options.onError;

  const extractKeyAndTakeToken = function(limitd, request, reply, type) {
    extractKey(request, reply, (err, key) =>{
      if (err) { return reply(err); }

      if (!limitd) {
        // limitd is not connected, do not fail!
        return reply.continue();
      }

      limitd.take(type, key, (err, resp) => {
        if (err){
          if (onError) { return onError(err, reply); }
          // by default we don't fail if limitd is unavailable
          return reply.continue();
        }

        const rlRequest = new RateLimitedRequest(request.id, resp);
        const r = pendingRequests.keepWorse(rlRequest);

        if (rlRequest.isConformant()) {
          return reply.continue();
        }

        const error = Boom.tooManyRequests();
        error.output.headers = rlRequest.getResponseHeaders();

        reply(error);
      });
    });
  };

  const getType = function(request, reply, callback) {
    const type = options.type;

    if (typeof type !== 'function') {
      return process.nextTick(() => callback(null, type));
    }

    try {
      return type(request, (err, type) => {
        if (err) {
          return reply(Boom.wrap(err, 500, 'cannot get bucket type'));
        }

        callback(null, type);
      });
    } catch (err) {
      return reply(Boom.wrap(err, 500, 'cannot get bucket type'));
    }
  };

  server.ext(event, (request, reply) => {

    // If current response is already not conformant we can stop
    const currentRlRequest = pendingRequests.get(request.id);
    if (currentRlRequest && !currentRlRequest.isConformant()) { return; }

    getType(request, reply, (err, type) => {
      extractKeyAndTakeToken(options.limitd, request, reply, type);
    });
  });
}

exports.register = function (server, options, next) {

  Joi.validate(options, schema, { abortEarly: false }, (err, processedOptions) => {
    if (err) { return next(err); }

    setupRateLimitEventExt(server, processedOptions);
    setupPreResponseExt(server);

    next();
  });

};

exports.register.attributes = {
  pkg: require('../package.json'),
  multiple: true
};
