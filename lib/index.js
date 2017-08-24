'use strict';

const Boom = require('boom');
const Joi = require('joi');
const RateLimitHeaders = require('./rate_limit_headers');

const schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']),
  type: [Joi.string(), Joi.func()],
  limitd: Joi.object(),
  onError: Joi.func(),
  extractKey: Joi.func(),
  enabled: Joi.boolean().default(true),
  sendResponseHeaders: Joi.boolean().default(true)
}).requiredKeys('type', 'event', 'limitd', 'extractKey');

function setResponseHeader(request, header, value) {
  if (!request.response) { return; }

  if (request.response.isBoom) {
    request.response.output.headers[header] = value;
  } else {
    request.response.header(header, value);
  }
}

function getMinimumLimit(limit1, limit2) {
  if (!limit1) { return limit2; }
  if (!limit2) { return limit1; }

  if (limit2.remaining > limit1.remaining) {
    return limit1;
  }

  return limit2;
}

function setupRateLimitEventExt(server, pluginOptions) {
  const event = pluginOptions.event;

  const extractKeyAndTakeToken = function(options, request, reply, type) {
    options.extractKey(request, reply, (err, key) =>{
      const limitd = options.limitd;
      if (err) { return reply(err); }

      if (!limitd) {
        // limitd is not connected, do not fail!
        return reply.continue();
      }

      limitd.take(type, key, (err, currentLimitResponse) => {
        if (err) {
          if (options.onError) { return options.onError(err, reply); }
          // by default we don't fail if limitd is unavailable
          return reply.continue();
        }

        const oldMinimumLimitResponse = request.plugins.patova && request.plugins.patova.limit;
        const newMinimumLimitResponse = getMinimumLimit(currentLimitResponse, oldMinimumLimitResponse);

        request.plugins.patova = request.plugins.patova || {};
        request.plugins.patova.limit = newMinimumLimitResponse;

        if (newMinimumLimitResponse.conformant) {
          // We continue only if the request is conformat so far
          return reply.continue();
        }

        const error = Boom.tooManyRequests();
        if (options.sendResponseHeaders) {
          error.output.headers = new RateLimitHeaders(
            newMinimumLimitResponse.limit,
            newMinimumLimitResponse.remaining,
            newMinimumLimitResponse.reset);
        }

        reply(error);
      });
    });
  };

  const getType = function(options, request, reply, callback) {
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
    const options = getRouteOptions(request);
    if (!options.enabled) {
      return reply.continue();
    }
    // This handler is going to be called one time per registration of patova
    getType(options, request, reply, (err, type) => {
      extractKeyAndTakeToken(options, request, reply, type);
    });
  });

  server.ext('onPreResponse', (request, reply) => {
    const requestLimit = request.plugins.patova && request.plugins.patova.limit;

    if (requestLimit && requestLimit.conformant) {
      const options = getRouteOptions(request);
      if (options.sendResponseHeaders) {
        const headers = new RateLimitHeaders(
            requestLimit.limit,
            requestLimit.remaining,
            requestLimit.reset);

        Object.keys(headers).forEach(
          key => setResponseHeader(request, key, headers[key]));
      }
    }
    reply.continue();
  });

  function getRouteOptions(request) {
    const routeOptions = request.route.settings.plugins.patova;
    if (routeOptions === undefined) {
      return pluginOptions;
    }
    return Object.assign({}, pluginOptions, {enabled: true}, routeOptions);
  }

}

exports.register = function(server, pluginOptions, next) {
  Joi.validate(pluginOptions, schema, { abortEarly: false }, (err, processedOptions) => {
    if (err) { return next(err); }
    setupRateLimitEventExt(server, processedOptions);
    next();
  });
};

exports.register.attributes = {
  pkg: require('../package.json'),
  multiple: true
};
