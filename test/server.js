var Hapi = require('hapi');
var plugin = require('../');
var Boom = require('boom');

var server;

exports.start = function(replyOptions, pluginOptions, done){
  server = new Hapi.Server();

  server.connection({
    host: 'localhost',
    port: 3001,
  });

  server.route({
    method: 'POST',
    path:'/users',
    handler: function (request, reply) {
      if (replyOptions.replyError) {
        reply(Boom.forbidden('You cannot access Zion'));
      } else {
        reply('created');
      }
    }
  });

  server.route({
    method: 'GET',
    path:'/forever',
    handler: function (request, reply) {
      setTimeout(() => reply('created'), 1000);
    }
  });

  const allPluginOptions = Array.isArray(pluginOptions) ? pluginOptions : [ pluginOptions ];

  const plugins = allPluginOptions.map(pluginOptions => this.desc(pluginOptions));

  server.register(plugins, err => {
    if (err) { throw err; }

    server.start(done);
  });
};

exports.desc = function(pluginOptions) {
  return {
    register: plugin,
    options: pluginOptions,
  };
};

exports.inject = function(){
  server.inject.apply(server, Array.prototype.slice.call(arguments, 0));
};

exports.stop = function(done){
  server.stop(done);
};
