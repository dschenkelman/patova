var LimitdClient = require('limitd-client');
var Boom = require('boom');
var Joi = require('joi');

var schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']),
  type: Joi.string(),
  address: [Joi.string().uri({
    scheme: 'limitd'
  }), Joi.object().keys({
    port: Joi.number(),
    host: Joi.string()
  })],
  onError: Joi.func(),
  extractKey: Joi.func()
}).requiredKeys('type', 'event', 'address', 'extractKey');

exports.register = function (server, options, next) {
  Joi.validate(options, schema, { abortEarly: false }, function (err, processedOptions) {
    if (err) { return next(err); }

    var event = processedOptions.event;
    var type = processedOptions.type;
    var extractKey = processedOptions.extractKey;
    var onError = processedOptions.onError;
    var limitd = new LimitdClient(processedOptions.address);

    limitd.on('error', function(){
      // ignore. what to do on error is decided by on error
    });

    server.ext(event, function(request, reply){
      extractKey(request, reply, function(err, key){
        if (err) {
          return reply(err);
        }

        limitd.take(type, key, function (err, resp) {
          if (err){
            if (onError) { return onError(err, reply); }
            // by default we don't fail if limitd is unavailable
            return reply.continue();
          }

          if (resp.conformant) { return reply.continue(); }

          var error = Boom.tooManyRequests();
          error.output.headers = {
            'X-RateLimit-Limit': resp.limit,
            'X-RateLimit-Remaining': resp.remaining,
            'X-RateLimit-Reset': resp.reset
          };

          reply(error);
        });
      });
    });

    next();
  });

};

exports.register.attributes = {
  pkg: require('../package.json')
};