'use strict';
const expect       = require('chai').expect;
const Boom         = require('boom');
const LimitdClient = require('limitd-client');
const plugin       = require('../');
const server       = require('./server');
const limitServer  = require('./limitdServer');

const EXTRACT_KEY_NOOP = () => {};

function getLimitdClient(address) {
  if (!address) {
    address = 'limitd://10.0.0.1:8090';
  }
  return new LimitdClient({ hosts: [ address ] });
}

describe('options validation', () => {
  it('should fail if event is not specified', async () => {
    try {
      await plugin.register(null, {
        type: 'user',
        limitd: getLimitdClient(),
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"event" is required');
    }
  });

  it('should fail if event is not valid', async () => {
    try {
      await plugin.register(null, {
        event: 'invalid',
        type: 'user',
        limitd: getLimitdClient(),
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"event" must be one of [onRequest, onPreAuth, onPostAuth, onPreHandler]');
    }
  });

  it('should fail if type is not specified', async () => {
    try {
      await plugin.register(null, {
        event: 'onRequest',
        limitd: getLimitdClient(),
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is required');
    }
  });

  it('should fail if type is of wrong type', async () => {
    try {
      await plugin.register(null, {
        type: 2,
        event: 'onRequest',
        limitd: getLimitdClient(),
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(2);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" must be a string');
    }
  });

  it('should fail if type is empty string', async () => {
    try {
      await plugin.register(null, {
        type: '',
        event: 'onRequest',
        limitd: getLimitdClient(),
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(2);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"type" is not allowed to be empty');
    }
  });

  it('should fail if onError is not a function', async () => {
    try {
      await plugin.register(null, {
        type: 'user',
        event: 'onRequest',
        limitd: getLimitdClient(),
        onError: 'string',
        extractKey: EXTRACT_KEY_NOOP
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"onError" must be a Function');
    }
  });

  it('should fail if extractKey is not a function', async () => {
    try {
      await plugin.register(null, {
        type: 'user',
        event: 'onRequest',
        limitd: getLimitdClient(),
        extractKey: 'string'
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" must be a Function');
    }
  });

  it('should fail if extractKey is not provided', async () => {
    try {
      await plugin.register(null, {
        type: 'user',
        event: 'onRequest',
        limitd: getLimitdClient(),
      });
      expect(false, 'this should not be reached').to.be.true;
    } catch (err) {
      expect(err.details).to.have.length(1);

      const firstError = err.details[0];
      expect(firstError.message).to.equal('"extractKey" is required');
    };
  });
});

describe('with server', () => {
  describe('when extractKey fails', () => {
    before(() => server.start({ replyError: false }, {
      type: 'user',
      limitd: getLimitdClient(),
      extractKey: () => {
        throw Boom.internal('Failed to retrieve key');
      },
      event: 'onPostAuth'
    }));

    after(server.stop);

    it('should send response with error', async () => {
      const request = { method: 'POST', url: '/users', payload: { } };
      const res = await server.inject(request)

      const body = JSON.parse(res.payload);

      expect(res.statusCode).to.equal(500);
      expect(body.statusCode).to.equal(500);
      expect(body.error).to.equal('Internal Server Error');
      expect(body.message).to.equal('An internal server error occurred');

    });
  });

  describe('when limitd does not provide a response and there is no onError',function(){
    before(() => server.start({ replyError: false }, {
      type: 'user',
      limitd: getLimitdClient(),
      extractKey: () => Promise.resolve('notImportant'),
      event: 'onPostAuth'
    }));

    after(server.stop);

    it('should return 200', async () => {
      const request = { method: 'POST', url: '/users', payload: { } };
      const res = await server.inject(request);

      expect(res.statusCode).to.equal(200);
      expect(res.payload).to.equal('created');
    });
  });

  describe('when limitd does not respond and there is onError', () => {
    before(() => server.start({ replyError: false }, {
      type: 'user',
      limitd: getLimitdClient(),
      extractKey: () => Promise.resolve('notImportant'),
      event: 'onPostAuth',
      onError: (err) => Promise.reject(Boom.wrap(err, 500))
    }));

    after(server.stop);

    it('should return what onError returns', async () => {
      const request = { method: 'POST', url: '/users', payload: { } };
      const res = await server.inject(request);
      const body = JSON.parse(res.payload);

      expect(res.statusCode).to.equal(500);
      expect(body.statusCode).to.equal(500);
      expect(body.error).to.equal('Internal Server Error');
      expect(body.message).to.equal('An internal server error occurred');

    });
  });

  describe('when type is a function', () => {

    describe('and it fails with a callback error', () => {
      before(() => server.start({ replyError: false }, {
        type: () => Promise.reject(new Error('failed!')),
        limitd: getLimitdClient(),
        extractKey: () => Promise.resolve('notImportant'),
        event: 'onPostAuth'
      }));

      after(server.stop);

      it ('should send response with error', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const res = await server.inject(request);
        const body = JSON.parse(res.payload);

        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

      });
    });

    describe('and it fails with a thrown error', () => {
      before(() => server.start({ replyError: false }, {
        type: () => { throw new Error('failed!'); },
        limitd: getLimitdClient(),
        extractKey: () => Promise.resolve('notImportant'),
        event: 'onPostAuth'
      }));

      after(server.stop);

      it ('should send response with error', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };

        const res = await server.inject(request);
        const body = JSON.parse(res.payload);
        expect(res.statusCode).to.equal(500);
        expect(body.statusCode).to.equal(500);
        expect(body.error).to.equal('Internal Server Error');
        expect(body.message).to.equal('An internal server error occurred');

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
        emptyType: () => Promise.resolve('empty'),
        usersType: () => Promise.resolve('users'),
        bucket3type: () => Promise.resolve('bucket_3'),
        bucket4type: () => Promise.resolve('bucket_4')
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
      before(() => server.start({ replyError: false }, {
        type: options.emptyType,
        limitd: getLimitdClient(address),
        extractKey: () => Promise.resolve('notImportant'),
        event: 'onPostAuth',
        onError: (err) => Boom.wrap(err, 500)
      }));

      after(server.stop);

      it('should send response with 429 and headers', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const res = await server.inject(request)
        const body = JSON.parse(res.payload);
        const headers = res.headers;

        expect(body.statusCode).to.equal(429);
        expect(body.error).to.equal('Too Many Requests');

        expect(headers['x-ratelimit-limit']).to.equal(0);
        expect(headers['x-ratelimit-remaining']).to.equal(0);
        expect(headers['x-ratelimit-reset']).to.equal(0);
      });
    });

    describe('and request response is an error', () => {
      before(() => server.start({ replyError: true }, {
        type: options.emptyType,
        limitd: getLimitdClient(address),
        extractKey: () => Promise.resolve('notImportant'),
        event: 'onPostAuth',
        onError: (err) => Boom.wrap(err, 500)
      }));

      after(server.stop);

      it('should send response with 429 and headers', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const res = await server.inject(request)
        const body = JSON.parse(res.payload);
        const headers = res.headers;

        expect(body.statusCode).to.equal(429);
        expect(body.error).to.equal('Too Many Requests');

        expect(headers['x-ratelimit-limit']).to.equal(0);
        expect(headers['x-ratelimit-remaining']).to.equal(0);
        expect(headers['x-ratelimit-reset']).to.equal(0);

      });
    });
  });

  describe('when check is skipped', () => {
    before(() => server.start({ replyError: false }, {
      type: options.emptyType,
      limitd: getLimitdClient(address),
      extractKey: (request, flowControl) => Promise.resolve(flowControl.continue),
      event: 'onPostAuth',
      onError: (err) => Boom.wrap(err, 500)
    }));

    after(server.stop);

    it('should send response with 200', async () => {
      const request = { method: 'POST', url: '/users', payload: { } };
      const res = await server.inject(request)
      expect(res.statusCode).to.equal(200);
      expect(res.payload).to.equal('created');
    });
  });
  describe('when limitd responds conformant', () => {
    describe('and request response is normal', () => {
      before(() => server.start({ replyError: false }, {
        type: options.usersType,
        limitd: getLimitdClient(address),
        extractKey: () => Promise.resolve('key'),
        event: 'onPostAuth',
        onError: (err) => Boom.wrap(err, 500)
      }));

      after(server.stop);

      it('should send response with 200 if limit is not passed and set limit header', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        const res = await server.inject(request);
        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.equal('created');

        const headers = res.headers;
        expect(headers['x-ratelimit-limit']).to.equal(1000000);
        expect(headers['x-ratelimit-remaining']).to.equal(999999);
        expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);
      });
    });

    describe('and request response is an error', () => {
      before(() => server.start({ replyError: true }, {
        type: options.usersType,
        limitd: getLimitdClient(address),
        extractKey: () => Promise.resolve('key'),
        event: 'onPostAuth',
        onError: (err) => Boom.wrap(err, 500)
      }));

      after(server.stop);

      it('should send response with 403 if limit is not passed and set limit header', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        const res = await server.inject(request);
        const body = JSON.parse(res.payload);
        const headers = res.headers;

        expect(body.statusCode).to.equal(403);
        expect(body.error).to.equal('Forbidden');

        expect(headers['x-ratelimit-limit']).to.equal(1000000);
        expect(headers['x-ratelimit-remaining']).to.equal(999999);
        expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);
      });
    });
  });

  describe('when plugin is registered multiple times', function() {

    describe('when limitd responds conformant', () => {
      before(() => server.start({ replyError: false }, [
        {
          type: options.bucket3type,
          limitd: getLimitdClient(address),
          extractKey: () => Promise.resolve('key'),
          event: 'onRequest'
        },
        {
          type: options.bucket4type,
          limitd: getLimitdClient(address),
          extractKey: () => Promise.resolve('key'),
          event: 'onRequest'
        }
      ]));

      after(server.stop);

      it('should send response with 200 if limit is not passed and set limit header to the lowest remaining limit', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const startDate = Math.floor((new Date()).getTime() / 1000);
        const res = await server.inject(request);
        expect(res.statusCode).to.equal(200);
        expect(res.payload).to.equal('created');

        const headers = res.headers;
        expect(headers['x-ratelimit-limit']).to.equal(3);
        expect(headers['x-ratelimit-remaining']).to.equal(2);
        expect(headers['x-ratelimit-reset']).to.be.greaterThan(startDate);
      });
    });

    describe('when limitd responds not conformant', () => {
      before(() => server.start({ replyError: true }, [
        {
          type: options.bucket3type,
          limitd: getLimitdClient(address),
          extractKey: () => Promise.resolve('key'),
          event: 'onRequest'
        },
        {
          type: options.emptyType,
          limitd: getLimitdClient(address),
          extractKey: () => Promise.resolve('key'),
          event: 'onRequest'
        },
        {
          type: options.bucket3type,
          limitd: getLimitdClient(address),
          extractKey: () => Promise.resolve('key'),
          event: 'onRequest'
        }
      ]));

      after(server.stop);

      it('should send response with 429 if limit has passed for some plugin configuration and set limit header', async () => {
        const request = { method: 'POST', url: '/users', payload: { } };
        const res = await server.inject(request);
        const body = JSON.parse(res.payload);
        const headers = res.headers;

        expect(res.statusCode).to.equal(429);
        expect(body.error).to.equal('Too Many Requests');

        expect(headers['x-ratelimit-limit']).to.equal(0);
        expect(headers['x-ratelimit-remaining']).to.equal(0);
        expect(headers['x-ratelimit-reset']).to.equal(0);

      });
    });
  });
}
