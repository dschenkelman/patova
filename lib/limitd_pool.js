'use strict';

const LimitdClient = require('limitd-client');
const clients = new Map();

function addToMap(address, limitd) {
  clients.set(address, limitd);
}

exports.prepare = function(address) {
  let options = address;

  if (typeof address === 'object' && 'host' in address) {
    options  = { hosts: [ address ] };
  }

  const limitd = new LimitdClient(options);

  limitd.on('error', () => {
    // ignore. what to do on error is decided by on error
  });

  limitd.on('close', () => {
    clients.delete(address);
  });

  // When limitd gets disconnected, it will emit 'reconnect' events while it is trying to get connected back.
  limitd.on('reconnect', ()=> {
    clients.delete(address);
  });

  //  limitd gets connected or reconnected
  limitd.on('ready', ()=> {
    addToMap(address, limitd);
  });

  addToMap(address, limitd);

  return limitd;
};

// We can register the plugin as many times as we
// want, lets keep the min number of opened connections
exports.get = function get(address) {
  return clients.get(address);
};
