var Hapi = require('hapi');

var users = {
  john: {
    username: 'john',
    password: 'secret',
    name: 'John Doe',
    id: '2133d32a'
  }
};

var server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

var validate = function (username, password, callback) {
  var user = users[username];
  if (!user) { return callback(null, false); }

  var isValid = password === user.password;
  callback(null, isValid, { id: user.id, name: user.name });
};

var plugins = [ require('hapi-auth-basic') ];

var patovaConfig = {
  register: require('patova'),
  options: {
    event: 'onPostAuth',
    type: 'user',
    address: { host: '127.0.0.1', port: 9001 },
    extractKey: function(request, reply, done){
      var key = request.auth.credentials.id;
      done(null, key);
    }
  },
};

plugins.push(patovaConfig);

server.register(plugins, function (err) {
  server.auth.strategy('simple', 'basic', { validateFunc: validate });
  server.route({
    method: 'GET',
    path: '/',
    config: {
      auth: 'simple',
      handler: function(request, reply){
        reply(request.auth.credentials.name);
      }
    }
  });
});

server.start();