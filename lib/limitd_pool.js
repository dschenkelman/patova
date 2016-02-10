'use strict';

const LimitdClient = require('limitd-client');
const clients = new Map();

exports.prepare = function(address) {
  const limitd = new LimitdClient(address);

  limitd.on('close', () => {
    clients.delete(address);
  });

  limitd.on('error', () => {
    // ignore. what to do on error is decided by on error
  });

  clients.set(address, limitd);

  return limitd;
};

// We can register the plugin as many times as we
// want, lets keep the min number of opened connections
exports.get = function get(address) {
  return clients.get(address);
};
