var Hapi = require('hapi');
var plugin = require('../');

var server;

exports.start = function(pluginOptions, done){
  server = new Hapi.Server();
  server.connection({
    host: 'localhost',
    port: 3001,
  });

  server.register({
    register: plugin,
    options: pluginOptions,
  }, function (err) {
    if (err) { throw err; }

    server.route({
      method: 'POST',
      path:'/users',
      handler: function (request, reply) {
        reply('created');
      }
    });

    server.start(done);
  });
};

exports.inject = function(){
  server.inject.apply(server, Array.prototype.slice.call(arguments, 0));
};

exports.stop = function(done){
  server.stop(done);
};