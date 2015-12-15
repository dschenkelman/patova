const Hapi = require('hapi');

const users = {
  john: {
    username: 'john',
    password: 'secret',
    name: 'John Doe',
    id: '2133d32a'
  }
};

const server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

const validate = function (username, password, callback) {
  const user = users[username];
  if (!user) { return callback(null, false); }

  const isValid = password === user.password;
  callback(null, isValid, { id: user.id, name: user.name });
};

const plugins = [ require('hapi-auth-basic') ];

const patovaConfig = {
  register: require('patova'),
  options: {
    event: 'onPostAuth',
    type: 'user',
    address: { host: '127.0.0.1', port: 9001 },
    extractKey: (request, reply, done) => {
      const key = request.auth.credentials.id;
      done(null, key);
    }
  },
};

plugins.push(patovaConfig);

server.register(plugins, () =>  {
  server.auth.strategy('simple', 'basic', { validateFunc: validate });
  server.route({
    method: 'GET',
    path: '/',
    config: {
      auth: 'simple',
      handler: (request, reply) => {
        reply(request.auth.credentials.name);
      }
    }
  });
});

server.start();