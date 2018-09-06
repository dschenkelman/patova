'use strict';
const expect       = require('chai').expect;
const Boom         = require('boom');
const LimitdClient = require('limitd-client');
const plugin       = require('../');
const server       = require('./server');
const limitServer  = require('./limitdServer');
const request      = require('request');

const EXTRACT_KEY_NOOP = () => {};

function getLimitdClient(address) {
  if (!address) {
    address = 'limitd://10.0.0.1:8090';
  }
  return new LimitdClient({ hosts: [ address ] });
}

describe('options validation', () => {
  it ('should fail if event is not specified', () => {
    plugin.register(null, {
      type: 'user',
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient(),
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
      limitd: getLimitdClient()
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" is required');
    });
  });

  it ('should fail if limitResponseHandler is not a function', () => {
    plugin.register(null, {
      type: 'user',
      event: 'onRequest',
      limitd: getLimitdClient(),
      limitResponseHandler: 'string',
      extractKey: EXTRACT_KEY_NOOP
    }, err => {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"limitResponseHandler" must be a Function');
    });
  });
});

describe('with server', () => {
  describe ('when extractKey fails', () => {
    before(done => {
      server.start({ replyError: false }, {
        type: 'user',
        limitd: getLimitdClient(),
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
        limitd: getLimitdClient(),
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

  describe ('when limitd does not respond and there is onError', () => {
    before(done => {
      server.start({ replyError: false }, {
        type: 'user',
        limitd: getLimitdClient(),
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
          limitd: getLimitdClient(),
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
          type: () => { throw new Error('failed!'); },
          limitd: getLimitdClient(),
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
          limitd: getLimitdClient(address),
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
          limitd: getLimitdClient(address),
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
        limitd: getLimitdClient(address),
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
          limitd: getLimitdClient(address),
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
          limitd: getLimitdClient(address),
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
            limitd: getLimitdClient(address),
            extractKey: (request, reply, done) => { done(null, 'key'); },
            event: 'onRequest'
          },
          {
            type: options.bucket4type,
            limitd: getLimitdClient(address),
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
      describe('and when limitResponseHandler is not provided', () => {
        before((done) => {
          server.start({ replyError: false }, [
            {
              type: options.bucket3type,
              limitd: getLimitdClient(address),
              extractKey: (request, reply, done) => { done(null, 'key'); },
              event: 'onRequest'
            },
            {
              type: options.emptyType,
              limitd: getLimitdClient(address),
              extractKey: (request, reply, done) => { done(null, 'key'); },
              event: 'onRequest'
            },
            {
              type: options.bucket3type,
              limitd: getLimitdClient(address),
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

      describe('and when limitResponseHandler is provided', () => {
        before((done) => {
          server.start({ replyError: false }, [
            {
              type: options.bucket3type,
              limitd: getLimitdClient(address),
              extractKey: (request, reply, done) => { done(null, 'key'); },
              event: 'onRequest',
              limitResponseHandler: (result, request, reply) => reply.continue()
            },
            {
              type: options.emptyType,
              limitd: getLimitdClient(address),
              extractKey: (request, reply, done) => { done(null, 'key'); },
              event: 'onRequest',
              limitResponseHandler: (result, request, reply) => reply.continue()
            },
            {
              type: options.bucket3type,
              limitd: getLimitdClient(address),
              extractKey: (request, reply, done) => { done(null, 'key'); },
              event: 'onRequest',
              limitResponseHandler: (result, request, reply) => reply.continue()
            }
          ], done);
        });

        after(server.stop);

        it('should call limitResponseHandler to handle the answer', function(done){
          const request = { method: 'POST', url: '/users', payload: { } };
          server.inject(request, res => {
            expect(res.statusCode).to.equal(200);
            expect(res.payload).to.eql('created')

            done();
          });
        });
      });
    });
  });
}
