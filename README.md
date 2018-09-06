# patova ![](https://travis-ci.org/dschenkelman/patova.svg?branch=master)
A [limitd](https://github.com/auth0/limitd) plug-in for hapi.js

## Install
```
npm i -S patova
```

## Registering the plug-in
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

## Options
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
* `limitResponseHandler: (limitResult, req, reply) => ()` A function that receives the result of limit checking against limitd, the `request` and the reply interface and is responsible for sending the handling
how to respond to the customer. This function will be called only when non-conformant limits are detected.
  * `limitResult: The result object from limit verification`:
      * conformant: whether the response was conformant (is always `false` for this handler, but is kept for consistency)
      * limit: the limit of tokens that the bucket accepts
      * remaining: number of remaining tokens (is always 0 for this handler, but is kept for consistency)
      * reset: next reset timestamp
  * `request: Request` - The hapi.js [request object](http://hapijs.com/api#request-object).
  * `reply: Reply` - The hapi.js [reply interface](http://hapijs.com/api#reply-interface). Useful if you want to skip the check.

## Contributing
Feel free to open issues with questions/bugs/features. PRs are also welcome.

## License
MIT
