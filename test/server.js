var Hapi = require('hapi');
var plugin = require('../');
var Boom = require('boom');

var server;

exports.start = async function(replyOptions, pluginOptions){
  server = new Hapi.Server({
    host: 'localhost',
    port: 3001,
  });

  server.route({
    method: 'POST',
    path: '/users',
    handler: () => {
      if (replyOptions.replyError) {
        throw Boom.forbidden('You cannot access Zion');
      }

      return 'created';
    }
  });

  server.route({
    method: 'GET',
    path: '/forever',
    handler: () => new Promise((resolve) => setTimeout(resolve, 1000, 'created'))
  });

  const allPluginOptions = Array.isArray(pluginOptions) ? pluginOptions : [ pluginOptions ];

  const plugins = allPluginOptions.map(options => ({ plugin, options }));

  await server.register(plugins);
  return await server.start();
};

exports.inject = function(){
  return server.inject.apply(server, Array.prototype.slice.call(arguments, 0));
};

exports.stop = function(){
  return server.stop();
};
