var rimraf = require('rimraf');
var path  = require('path');
var xtend = require('xtend');
var LimitdServer = require('limitd').Server;
var LimitdClient = require('limitd').Client;

var server;

exports.start = function(done){
  var db_file = path.join(__dirname, 'dbs', 'server.tests.db');

  try{
    rimraf.sync(db_file);
  } catch(err){}

  server = new LimitdServer(xtend({db: db_file}, require('./limitdConfig')));

  server.start(function (err, address) {
    if (err) { return done(err); }
    client = new LimitdClient({ host: address.address, port: address.port });
    client.once('connect', function(){
      done(address);
    });
  });
};

exports.stop = function () {
  server.stop();
};