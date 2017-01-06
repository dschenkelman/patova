'use strict';

const expect        = require('chai').expect;
const async         = require('async');
const limitdPool    = require('../lib/limitd_pool');
const limitdServer  = require('./limitdServer');
const LimitdClient  = require('limitd-client');

describe('limitd_pool', function() {

  describe('connected to one limitd server instance', function() {

    let server;
    let address;

    function stopServer(done) {
      server.stop(function() {
        setTimeout(done, 300);
      });
    }

    function startServer(done) {
      server.start(function() {
        setTimeout(done, 300);
      });
    }

    before(function() {
      // create server instance
      server = limitdServer.create(9001);
      address = 'limitd://127.0.0.1:9001';
      limitdPool.prepare(address);
    });

    describe('when limitd server is running', function() {

      before(startServer);

      it('the get method should return limitd client instance', function() {
        const client = limitdPool.get(address);
        expect(client).to.be.an.instanceof(LimitdClient);
      });

      describe('if limitd server gets down', function() {
        
        before(stopServer);

        it('get method should return undefined', function() {
          const client = limitdPool.get(address);
          expect(client).to.be.undefined;
        });

        describe('and if limitd gets up again', function() {

          before(startServer);

          it('get method should return limitd client instance', function() {
            const client = limitdPool.get(address);
            expect(client).to.be.an.instanceof(LimitdClient);
          });
        });
      });
    });

    after(stopServer);
  });

  describe('connected to many limitd server instances', function() {

    let servers = [];
    let addresses = [];

    before (function() {
      // create all limitd server instances.
      servers = [9001, 9002, 9003].map((port) => {
        addresses.push(`limitd://127.0.0.1:${port}`);
        return limitdServer.create(port);
      });

      limitdPool.prepare(addresses);
    });

    describe('when all limitd servers are running', function() {

      before(function(done) {
        async.each(servers, function (server, cb) {
          server.start(cb);
        },
        function (err) {
          setTimeout(done, 300, err);
        });
      });


      it('the get method should return a limitd client instance', function() {
        const client = limitdPool.get(addresses);
        expect(client).to.be.an.instanceof(LimitdClient);
      });

      describe('when just one server is running', function() {
        
        before(function(done) {
          async.parallel([
            servers[0].stop,
            servers[1].stop
            ],
            function (err) {
              setTimeout(done, 300, err);
            }
          );
        });

        it('the get method should return a limitd instance', function() {
          const client = limitdPool.get(addresses);
          expect(client).to.be.an.instanceof(LimitdClient);
        });

        describe('when all limitd servers are down', function() {
          
          before(function(done) {
            servers[2].stop(function (err) {
              setTimeout(done, 300, err);
            });
          });

          it('get method should return undefined', function() {
            const client = limitdPool.get(addresses);
            expect(client).to.be.undefined;
          });

          describe('and if a limitd server gets up again', function() {

            before(function(done) {
              servers[1].start(function (err) {
                setTimeout(done, 300, err);
              });
            });

            it('get method should return a limitd instance', function() {
              const client = limitdPool.get(addresses);
              expect(client).to.be.an.instanceof(LimitdClient);
            });
          });
        });
      });
    });

    after(function(done) {
      // release resources
      let count = servers.length;
      servers.forEach((server) => {
        server.stop(function cb() {
          if (--count === 0) {
            return done();
          }
        });
      });
    });
  });
});
