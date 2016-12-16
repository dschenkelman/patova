'use strict';

const rimraf = require('rimraf');
const path  = require('path');
const xtend = require('xtend');
const LimitdServer = require('limitd').Server;
const LimitdClient = require('limitd-client');

let instanceNumber = 0;

function create(port) {

  port = port || 9001;

  let server;
  
  return {

    start: function(done) {
      const db_file = path.join(__dirname, 'dbs', `server.${instanceNumber++}.tests.db`);

      try{
        rimraf.sync(db_file);
      } catch(err){}

      server = new LimitdServer(xtend({db: db_file, port: port}, require('./limitdConfig')));

      server.start(function (err, address) {
        if (err) { return done(err); }

        let client = new LimitdClient(`limitd://127.0.0.1:${port}`);
        client.once('connect', function(){
          client.disconnect();
          done(address);
        });
      });
    },

    stop: function (done) {
      server.once('close', function() {
        done();
      });
      server.stop();
    }
  };
}

exports.create = create;

// backguard compatibility
const instance = create();

exports.start = function(done) {
  return instance.start(done);
};

exports.stop = function(done) {
  return instance.stop(done);
};

