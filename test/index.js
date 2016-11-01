'use strict';
const expect  = require('chai').expect;
const plugin  = require('../');
const server  = require('./server');
const limitServer  = require('./limitdServer');
const Boom    = require('boom');

const EXTRACT_KEY_NOOP = () => {};

describe('options validation', () => {
  it ('should fail if event is not specified', () => {
    plugin.register(null, {
      type: 'user',
      address: 'limitd://10.0.0.1:8090',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"event" is required');
    });
  });

  it ('should fail if event is not valid', () => {
    plugin.register(null, {
      event: 'invalid',
      type: 'user',
      address: 'limitd://10.0.0.1:8090',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"event" must be one of [onRequest, onPreAuth, onPostAuth, onPreHandler]');
    });
  });

  it ('should fail if type is not specified', () => {
    plugin.register(null, {
      event: 'onRequest',
      address: {
        hosts: [ { host:'10.0.0.1', port:8090 } ]
      },
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is required');
    });
  });

  it ('should fail if type is of wrong type', () => {
    plugin.register(null, {
      type: 2,
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(2);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" must be a string');
    });
  });

  it ('should fail if type is empty string', () => {
    plugin.register(null, {
      type: '',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(2);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is not allowed to be empty');
    });
  });

  it ('should fail if onError is not a function', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      onError: 'string',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"onError" must be a Function');
    });
  });

  it ('should fail if extractKey is not a function', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
      extractKey: 'string'
    }, err => {
      expect(err.details).to.have.length(1);

      var firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" must be a Function');
    });
  });

  it ('should fail if extractKey is not provided', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      address: 'limitd://10.0.0.1:8090',
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" is required');
    });
  });

  it ('should fail if address is not provided', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);
      const firstError = err.details[0];
      expect(firstError.message).to.equal('"address" is required');
    });
  });

  it ('should fail if address is not string', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP,
      address: 1
    }, err => {
      expect(err.details).to.have.length(4);
    });
  });

  it ('should fail address is not uri with limitd schema', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP,
      address: 'https://auth0.com'
    }, err => {
      expect(err.details).to.have.length(4);
    });
  });

  it ('should fail address array items lack limitd schema', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP,
      address: ['limitd://some', 'http://auth0.com']
    }, err => {
      expect(err.details).to.have.length(4);
    });
  });

  it ('should fail address hosts objects are invalid', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP,
      address: {
        hosts: [{
          host: '10.0.0.1',
          port: 'test?'
        }]
      }
    }, err => {
      expect(err.details).to.have.length(4);
    });
  });

  it ('should fail address hosts array entries are invalid', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      extractKey: EXTRACT_KEY_NOOP,
      address: {
        hosts: ['limitd://some', 'http://auth0.com']
      }
    }, err => {
      expect(err.details).to.have.length(5);
    });
  });
});

describe('with server', () => {
  describe ('when extractKey fails', () => {
    before(done => {
      server.start({ replyError: false }, {
        type: 'user',
        address: 'limitd://10.0.0.1:8090',
        extractKey: (request, reply, done) => {
          done(Boom.internal('Failed to retrieve key'));
        },
        event: 'onPostAuth'
      }, done);
    });

    after(server.stop);

    it ('should send response with error', done => {
      const request = { method: 'POST', url: '/users', payload: { } };

      server.inject(request, res => {
        const body = JSON.parse(res.payload);

        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

        done();
      });
    });
  });

  describe ('when limitd does not provide a response and there is no onError',function(){
    before(done => {
      server.start({ replyError: false }, {
        type: 'user',
        address: {
          hosts: [ 'limitd://10.0.0.1:8090' ]
        },
        extractKey: (request, reply, done) => {
          done(null, 'notImportant');
        },
        event: 'onPostAuth'
      }, done);
    });

    after(server.stop);
    it('should return 200', done => {
      const request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, res => {
        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.equal('created');

        done();
      });
    });
  });

  describe ('when limitd does not responsd and there is onError', () => {
    before(done => {
      server.start({ replyError: false }, {
        type: 'user',
        address: [ 'limitd://10.0.0.1:8090' ],
        extractKey: (request, reply, done) => {
          done(null, 'notImportant');
        },
        event: 'onPostAuth',
        onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
      }, done);
    });

    after(server.stop);
    it('should return what onError returns', done => {
      const request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, res => {
        const body = JSON.parse(res.payload);

        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

        done();
      });
    });
  });

  describe ('when type is a function', () => {

    describe('and it fails with a callback error', () => {
      before(done => {
        server.start({ replyError: false }, {
          type: (request, callback) => { callback(new Error('failed!')); },
          address: {
            hosts: [ { host:'10.0.0.1', port:8090 } ]
          },
          extractKey: (request, reply, done) => {
            done(null, 'notImportant');
          },
          event: 'onPostAuth'
        }, done);
      });
      after(server.stop);

      it ('should send response with error', done => {
        const request = { method: 'POST', url: '/users', payload: { } };

        server.inject(request, res => {
          const body = JSON.parse(res.payload);

          expect(res.statusCode).to.equal(500);
          expect(body.statusCode).to.equal(500);
          expect(body.error).to.equal('Internal Server Error');
          expect(body.message).to.equal('An internal server error occurred');

          done();
        });
      });
    });

    describe('and it fails with a thrown error', () => {
      before(done => {
        server.start({ replyError: false }, {
          type: (request, callback) => { throw new Error('failed!'); },
          address: 'limitd://10.0.0.1:8090',
          extractKey: (request, reply, done) => {
            done(null, 'notImportant');
          },
          event: 'onPostAuth'
        }, done);
      });
      after(server.stop);

      it ('should send response with error', done => {
        const request = { method: 'POST', url: '/users', payload: { } };

        server.inject(request, res => {
          const body = JSON.parse(res.payload);

          expect(res.statusCode).to.equal(500);
          expect(body.statusCode).to.equal(500);
          expect(body.error).to.equal('Internal Server Error');
          expect(body.message).to.equal('An internal server error occurred');

          done();
        });
      });
    });
  });

  describe('with limitd running', () => {

    describe('when type is an string', () => {
      itBehavesLikeWhenLimitdIsRunning({
        emptyType: 'empty',
        usersType: 'users',
        bucket3type: 'bucket_3',
        bucket4type: 'bucket_4'
      });
    });

    describe('when type is a function', () => {
      itBehavesLikeWhenLimitdIsRunning({
        emptyType: (request, callback) => callback(null, 'empty'),
        usersType: (request, callback) => callback(null, 'users'),
        bucket3type: (request, callback) => callback(null, 'bucket_3'),
        bucket4type: (request, callback) => callback(null, 'bucket_4')
      });
    });

  });

});

function itBehavesLikeWhenLimitdIsRunning(options) {
  let address;

  before(done => {
    limitServer.start(r => {
      address = 'limitd://' + r.address +  ':' + r.port;
      done();
    });
  });

  after(limitServer.stop);

  describe('when limitd responds conformant', () => {
    describe('and request response is normal', () => {
      before(done => {
        server.start({ replyError: false }, {
          type: options.emptyType,
          address: address,
          extractKey: (request, reply, done) => { done(null, 'notImportant'); },
          event: 'onPostAuth',
          onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
        }, done);
      });

      after(server.stop);

      it('should send response with 429 and headers', done => {
        const request = { method: 'POST', url: '/users', payload: { } };
        server.inject(request, res => {
          const body = JSON.parse(res.payload);
          const headers = res.headers;

          expect(body.statusCode).to.equal(429);
          expect(body.error).to.equal('Too Many Requests');

          expect(headers['x-ratelimit-limit']).to.equal(0);
          expect(headers['x-ratelimit-remaining']).to.equal(0);
          expect(headers['x-ratelimit-reset']).to.equal(0);

          done();
        });
      });
    });

    describe('and request response is an error', () => {
      before(done => {
        server.start({ replyError: true }, {
          type: options.emptyType,
          address: address,
          extractKey: (request, reply, done) => { done(null, 'notImportant'); },
          event: 'onPostAuth',
          onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
        }, done);
      });

      after(server.stop);

      it('should send response with 429 and headers', done => {
        const request = { method: 'POST', url: '/users', payload: { } };
        server.inject(request, res => {
          const body = JSON.parse(res.payload);
          const headers = res.headers;

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

  describe('when check is skipped', () => {
    before(done => {
      server.start({ replyError: false }, {
        type: options.emptyType,
        address: address,
        extractKey: (request, reply) => { reply.continue(); },
        event: 'onPostAuth',
        onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
      }, done);
    });

    after(server.stop);

    it('should send response with 200', done => {
      const request = { method: 'POST', url: '/users', payload: { } };
      server.inject(request, res => {
        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.equal('created');

        done();
      });
    });
  });

  describe('when limitd responds conformant', () => {
    describe('and request response is normal', () => {
      before((done) => {
        server.start({ replyError: false }, {
          type: options.usersType,
          address: address,
          extractKey: (request, reply, done) => { done(null, 'key'); },
          event: 'onPostAuth',
          onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
        }, done);
      });

      after(server.stop);

      it('should send response with 200 if limit is not passed and set limit header', function(done){
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        server.inject(request, res => {
          expect(res.statusCode).to.equal(200);
          expect(res.payload).to.equal('created');

          const headers = res.headers;
          expect(headers['x-ratelimit-limit']).to.equal(1000000);
          expect(headers['x-ratelimit-remaining']).to.equal(999999);
          expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);

          done();
        });
      });
    });

    describe('and request response is an error', () => {
      before((done) => {
        server.start({ replyError: true }, {
          type: options.usersType,
          address: address,
          extractKey: (request, reply, done) => { done(null, 'key'); },
          event: 'onPostAuth',
          onError: (err, reply) => { reply(Boom.wrap(err, 500)); }
        }, done);
      });

      after(server.stop);

      it('should send response with 403 if limit is not passed and set limit header', function(done){
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        server.inject(request, res => {
          const body = JSON.parse(res.payload);
          const headers = res.headers;

          expect(body.statusCode).to.equal(403);
          expect(body.error).to.equal('Forbidden');

          expect(headers['x-ratelimit-limit']).to.equal(1000000);
          expect(headers['x-ratelimit-remaining']).to.equal(999999);
          expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);

          done();
        });
      });
    });
  });

  describe('when plugin is registered multiple times', function() {

    describe('when limitd responds conformant', () => {
      before((done) => {
        server.start({ replyError: false }, [
          {
            type: options.bucket3type,
            address: address,
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          },
          {
            type: options.bucket4type,
            address: address,
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          }
        ], done);
      });

      after(server.stop);

      it('should send response with 200 if limit is not passed and set limit header to the lowest remaining limit', function(done){
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        server.inject(request, res => {
          expect(res.statusCode).to.equal(200);
          expect(res.payload).to.equal('created');

          const headers = res.headers;
          expect(headers['x-ratelimit-limit']).to.equal(3);
          expect(headers['x-ratelimit-remaining']).to.equal(2);
          expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);

          done();
        });
      });
    });

    describe('when limitd responds not conformant', () => {
      before((done) => {
        server.start({ replyError: false }, [
          {
            type: options.bucket3type,
            address: address,
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          },
          {
            type: options.emptyType,
            address: address,
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          },
          {
            type: options.bucket3type,
            address: address,
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          }
        ], done);
      });

      after(server.stop);

      it('should send response with 429 if limit has passed for some plugin configuration and set limit header', function(done){
        const request = { method: 'POST', url: '/users', payload: { } };
        server.inject(request, res => {
          const body = JSON.parse(res.payload);
          const headers = res.headers;

          expect(res.statusCode).to.equal(429);
          expect(body.error).to.equal('Too Many Requests');

          expect(headers['x-ratelimit-limit']).to.equal(0);
          expect(headers['x-ratelimit-remaining']).to.equal(0);
          expect(headers['x-ratelimit-reset']).to.equal(0);

          done();
        });
      });
    });
  });
}
