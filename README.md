# patova ![](https://travis-ci.org/dschenkelman/patova.svg?branch=master)
A [limitd](https://github.com/auth0/limitd) plug-in for hapi.js

## Install
```
npm i -S patova
```

## Registering the plug-in (Hapi >= 17)
The following code snippet shows how to register the plug-in in your server:
```javascript
const Hapi = require('hapi');
const patova = require('patova');

const server = new Hapi.Server({ port: 9999 });

await server.register({
  plugin: patova,
  options: {
    event: 'onPostAuth',
    type: 'users',
    limitd: limitdClient,
    extractKey: (request) => request.auth.credentials
  },
});
```

## Options (Hapi <= 17)
The object has the following schema (validated [here](./lib/index.js) using [Joi](https://github.com/hapijs/joi)):

**Required**
* `event: String` - The name of the extension point in the request lifecycle when the bucket check must be performed. Options are `"onRequest"`, `"onPreAuth"`, `"onPostAuth"`,`"onPreHandler"` (anything before the request).
* `type: String|async (request, flowControl) => ()` - Either the bucket type as a string or a function. If you use a function, it will be called for every request, this could be a async function. It's possible to decide skip the check, for this return `flowControl.continue`;
* `limitd`: an instance of limitd client
* `extractKey: (request, flowControl) => ()` - A function that receives the `request` and the object `flowControl`.
  * `request: Request` - The hapi.js [request object](http://hapijs.com/api#request-object).
  * `flowControl` - This object contains a property `continue` to let the plugin know that you want to skip the check. Same situation to what happen in key.

**Optional**
* `onError: (error, h) => ()` - A function that takes the `error` that occurred when trying to get a token from the bucket and the `reply` interface.
  * `error: Error` - The error that occurred.
  * `h: ResponseToolkit` - The hapi.js [response toolkit](https://hapijs.com/api#response-toolkit).
  > If an error occurs and no function is provided, the request lifecycle continues normally as if there was no token bucket restriction. This is a useful default behavior in case the limitd server goes down.

## Registering the plug-in (Hapi <= 16)
The following code snippet shows how to register the plug-in in your server:
```javascript
const Hapi = require('hapi');
const patova = require('patova');

const server = new Hapi.Server();
server.connection({ /* options */ });

server.register({
  register: patova,
  options: {
    event: 'onPostAuth',
    type: 'users',
    limitd: limitdClient,
    extractKey: function(request, reply, done){
      var key = request.auth.credentials.userId;
      done(null, key);
    }
  },
}, err => {
  //
});
```

## Options (Hapi <= 16)
The object has the following schema (validated [here](./lib/index.js) using [Joi](https://github.com/hapijs/joi)):

**Required**
* `event: String` - The name of the extension point in the request lifecycle when the bucket check must be performed. Options are `"onRequest"`, `"onPreAuth"`, `"onPostAuth"`,`"onPreHandler"` (anything before the request).
* `type: String|(request, callback) => ()` - Either the bucket type as a string or a function. If you use a function, it will be called for every request, this function must invoke the callback function when it is finished.
* `limitd`: an instance of limitd client
* `extractKey: (request, reply, done) => ()` - A function that receives the `request` and a callback `done`.
  * `request: Request` - The hapi.js [request object](http://hapijs.com/api#request-object).
  * `reply: Reply` - The hapi.js [reply interface](http://hapijs.com/api#reply-interface). Useful if you want to skip the check.
  * `done: (err: Error, key: String)` - A function that takes an error as the first parameter and the bucket key as the second parameter.

**Optional**
* `onError: (error, reply) => ()` - A function that takes the `error` that occurred when trying to get a token from the bucket and the `reply` interface.
  * `error: Error` - The error that occurred.
  * `reply: Reply` - The hapi.js [reply interface](http://hapijs.com/api#reply-interface).
  > If an error occurs and no function is provided, the request lifecycle continues normally as if there was no token bucket restriction. This is a useful default behavior in case the limitd server goes down.

## Contributing
Feel free to open issues with questions/bugs/features. PRs are also welcome.

## Supported versions

| Hapi Version | Patova Version |
| ------------ | -------------- |
| Hapi <= 16   | v2.2.x         |
| Hapi >= 17   | v3.0.x         |

## License
MIT
