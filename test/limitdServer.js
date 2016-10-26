'use strict';

const rimraf = require('rimraf');
const path  = require('path');
const xtend = require('xtend');
const LimitdServer = require('limitd').Server;
const LimitdClient = require('limitd-client');

let server;
let instanceNumber = 0;

exports.start = function(done){
  const db_file = path.join(__dirname, 'dbs', `server.${instanceNumber++}.tests.db`);

  try{
    rimraf.sync(db_file);
  } catch(err){}

  server = new LimitdServer(xtend({db: db_file}, require('./limitdConfig')));

  server.start(function (err, address) {
    if (err) { return done(err); }
    const uri = 'limitd://' + address.address +  ':' + address.port;
    const client = new LimitdClient(uri);
    client.once('connect', function(){
      client.disconnect();

      done(address);
    });
  });
};

exports.stop = function (done) {
  server.once('close', () => done());

  server.stop();
};
