var expect  = require('chai').expect;
var plugin  = require('../');
var server  = require('./server');
var limitServer  = require('./limitdServer');
var Boom    = require('boom');

describe('options validation', function(){
  it ('should fail if event is not specified', function(){
    plugin.register(null, {
      type: 'user',
      address: 'limitd://10.0.0.1:8090',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"event" is required');
    });
  });

  it ('should fail if event is not valid', function(){
    plugin.register(null, {
      event: 'invalid',
      type: 'user',
      address: 'limitd://10.0.0.1:8090',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"event" must be one of [onRequest, onPreAuth, onPostAuth, onPreHandler]');
    });
  });

  it ('should fail if type is not specified', function(){
    plugin.register(null, {
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is required');
    });
  });

  it ('should fail if type is of wrong type', function(){
    plugin.register(null, {
      type: 2,
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"type" must be a string');
    });
  });

  it ('should fail if type is empty string', function(){
    plugin.register(null, {
      type: '',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is not allowed to be empty');
    });
  });

  it ('should fail if onError is not a function', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      onError: 'string',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"onError" must be a Function');
    });
  });

  it ('should fail if extractKey is not a function', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: 'string'
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" must be a Function');
    });
  });

  it ('should fail if extractKey is not provided', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" is required');
    });
  });

  it ('should fail if address is not provided', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: function(request, done){}
    }, function(err){
      expect(err.details).to.have.length(1);
      var firstError = err.details[0];
      expect(firstError.message).to.equal('"address" is required');
    });
  });

  it ('should fail if address is not string', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: function(request, done){},
      address: 1
    }, function(err){
      expect(err.details).to.have.length(2);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"address" must be a string');

      var secondError = err.details[1];
      expect(secondError.message).to.equal('"address" must be an object');
    });
  });

  it ('should fail address is not uri with limitd schema', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: function(request, done){},
      address: 'https://auth0.com'
    }, function(err){
      expect(err.details).to.have.length(2);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"address" must be a valid uri with a scheme matching the limitd pattern');

      var secondError = err.details[1];
      expect(secondError.message).to.equal('"address" must be an object');
    });
  });
});

describe('with server', function(){
  describe ('when extractKey fails',function(){
    before(function(done){
      server.start({
        type: 'user',
        address: 'limitd://10.0.0.1:8090',
        extractKey: function(request, done){
          done(Boom.internal('Failed to retrieve key'));
        },
        event: 'onPostAuth'
      }, done);
    });
    after(server.stop);

    it ('should send response with error', function(done){
      var request = { method: 'POST', url: '/users', payload: { } };

      server.inject(request, function (res) {
        var body = JSON.parse(res.payload);

        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

        done();
      });
    });
  });

  describe ('when limitd does not responsd and there is no onError',function(){
    before(function(done){
      server.start({
        type: 'user',
        address: 'limitd://10.0.0.1:8090',
        extractKey: function(request, done){
          done(null, 'notImportant');
        },
        event: 'onPostAuth'
      }, done);
    });

    after(server.stop);
    it('should return 200', function(done){
      var request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, function (res) {
        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.equal('created');

        done();
      });
    });
  });

  describe ('when limitd does not responsd and there is onError',function(){
    before(function(done){
      server.start({
        type: 'user',
        address: 'limitd://10.0.0.1:8090',
        extractKey: function(request, done){
          done(null, 'notImportant');
        },
        event: 'onPostAuth',
        onError: function(err, reply){
          return reply(Boom.wrap(err, 500));
        }
      }, done);
    });

    after(server.stop);
    it('should return what onError returns', function(done){
      var request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, function (res) {
        var body = JSON.parse(res.payload);

        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

        done();
      });
    });
  });

  describe('when limitd responds non conformant', function(){
    var address;
    before(function(done){
      limitServer.start(function(r){
        address = r;
        done();
      });
    });

    before(function(done){
      server.start({
        type: 'empty',
        address: { host: address.address, port: address.port },
        extractKey: function(request, done){
          done(null, 'notImportant');
        },
        event: 'onPostAuth',
        onError: function(err, reply){
          return reply(Boom.wrap(err, 500));
        }
      }, done);
    });

    it('should send response with 429 and headers', function(done){
      var request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, function (res) {
        var body = JSON.parse(res.payload);
        var headers = res.headers;

        expect(body.statusCode).to.equal(429);
        expect(body.error).to.equal('Too Many Requests');

        expect(headers['x-ratelimit-limit']).to.equal(0);
        expect(headers['x-ratelimit-remaining']).to.equal(0);
        expect(headers['x-ratelimit-reset']).to.equal(0);

        done();
      });
    });
  });
});