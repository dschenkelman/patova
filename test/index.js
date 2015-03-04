var expect  = require('chai').expect;
var plugin  = require('../');

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
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"address" must be a string');
    });
  });

  it ('should fail is not uri with limitd schema', function(){
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: function(request, done){},
      address: 'https://auth0.com'
    }, function(err){
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"address" must be a valid uri with a scheme matching the limitd pattern');
    });
  });
});