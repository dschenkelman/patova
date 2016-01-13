const LimitdClient = require('limitd-client');
const Boom = require('boom');
const Joi = require('joi');

const RateLimitHeaders = function(limit, remaining, reset){
  this['X-RateLimit-Limit'] = limit;
  this['X-RateLimit-Remaining'] = remaining;
  this['X-RateLimit-Reset'] = reset;
};

const schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']),
  type: [Joi.string(), Joi.func()],
  address: [Joi.string().uri({
    scheme: 'limitd'
  }), Joi.object().keys({
    port: Joi.number(),
    host: Joi.string()
  })],
  onError: Joi.func(),
  extractKey: Joi.func()
}).requiredKeys('type', 'event', 'address', 'extractKey');

const pendingRequests = new Map();

exports.register = function (server, options, next) {
  Joi.validate(options, schema, { abortEarly: false }, (err, processedOptions) => {
    if (err) { return next(err); }

    const event = processedOptions.event;
    const extractKey = processedOptions.extractKey;
    const onError = processedOptions.onError;
    const limitd = new LimitdClient(processedOptions.address);

    limitd.on('error', () => {
      // ignore. what to do on error is decided by on error
    });

    const extractKeyAndTakeToken = function(request, reply, type) {
      extractKey(request, reply, (err, key) =>{
        if (err) { return reply(err); }

        limitd.take(type, key, (err, resp) => {
          if (err){
            if (onError) { return onError(err, reply); }
            // by default we don't fail if limitd is unavailable
            return reply.continue();
          }

          const headers = new RateLimitHeaders(resp.limit, resp.remaining, resp.reset);

          if (resp.conformant) {
            pendingRequests.set(request.id, headers);
            return reply.continue();
          }

          const error = Boom.tooManyRequests();
          error.output.headers = headers;

          reply(error);
        });
      });
    };

    const getType = function(request, reply, callback) {
      const type = processedOptions.type;
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

    server.ext(event, (request, reply) =>
      getType(request, reply, (err, type) => {
        extractKeyAndTakeToken(request, reply, type);
      }));

    server.ext('onPreResponse', (request, reply) => {
      const headers = pendingRequests.get(request.id);
      if (headers){
        Object.keys(headers).forEach(
          key => request.response.header(key, headers[key]));
      }

      reply.continue();
    });

    next();
  });

};

exports.register.attributes = {
  pkg: require('../package.json')
};
