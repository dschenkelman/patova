var Limitd = require('limitd');
var Boom = require('boom');
var Joi = require('joi');

var schema = Joi.object().keys({
  event: Joi.any().valid(['onRequest', 'onPreAuth', 'onPostAuth', 'onPreHandler']).required(),
  type: Joi.string().required(),
  address: Joi.string().uri({
    scheme: 'limitd'
  }).required(),
  onError: Joi.func(),
  extractKey: Joi.func().required()
});

exports.register = function (server, options, next) {
  Joi.validate(options, schema, { abortEarly: false }, function (err, processedOptions) { 
    if (err) { return next(err); }

    var event = options.event;
    var type = options.type;
    var extractKey = options.extractKey;
    var onError = options.onError;
    var limitd = new Limitd(options.address);

    server.on(event, function(request, reply){
      extractKey(request, function(err, key){
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

          reply(Boom.tooManyRequests())
            .header('X-RateLimit-Limit', resp.limit)
            .header('X-RateLimit-Remaining', resp.remaining)
            .header('X-RateLimit-Reset', resp.reset);
        });
      });
    });

    next();
  });

};

exports.register.attributes = {
  pkg: require('../package.json')
};