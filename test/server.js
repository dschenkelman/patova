'use strict';
const  Hapi = require('hapi');
const  plugin = require('../');
const  Boom = require('boom');

let server;

exports.start = function(replyOptions, pluginOptions, done) {
  server = new Hapi.Server();

  server.connection({
    host: 'localhost',
    port: 3001
  });

  function handler(request, reply) {
    if (replyOptions.replyError) {
      reply(Boom.forbidden('You cannot access Zion'));
    } else {
      reply('created');
    }
  }

  server.route({
    method: 'POST',
    path:'/users',
    handler
  });

  server.route({
    method: 'GET',
    path:'/forever',
    handler: function(request, reply) {
      setTimeout(() => reply('created'), 1000);
    }
  });

  server.route({
    method: 'POST',
    path:'/empty',
    config: {
      plugins: {
        patova: {
          type: 'empty'
        }
      }
    },
    handler
  });

  server.route({
    method: 'POST',
    path:'/no_limit',
    config: {
      plugins: {
        patova: {
          enabled: false
        }
      }
    },
    handler
  });

  server.route({
    method: 'POST',
    path:'/always_limit',
    config: {
      plugins: {
        patova: {}
      }
    },
    handler
  });

  server.route({
    method: 'POST',
    path:'/no_headers',
    config: {
      plugins: {
        patova: {
          sendResponseHeaders: false
        }
      }
    },
    handler
  });

  server.route({
    method: 'POST',
    path:'/always_headers',
    config: {
      plugins: {
        patova: {
          sendResponseHeaders: true
        }
      }
    },
    handler
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
    options: pluginOptions
  };
};

exports.inject = function() {
  server.inject.apply(server, Array.prototype.slice.call(arguments, 0));
};

exports.stop = function(done) {
  server.stop(done);
};
