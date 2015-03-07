# basic-auth-patova-sample
A sample project that shows how to implement request throttling in hapi.js using patova.

## Installing
```
npm i
```

## Running the sample
There are two components that must be executing simultaneously:
* The API server
* The limitd server

To run the API server
```
> node server.js
```

To run the limitd server
```
> node_modules/patova/node_modules/limitd/bin/limitd --config-file limitd.config
```

Perform requests to reach the limit:
```
for i in {1..6}
do
  curl http://127.0.0.1:8000 -H "Authorization: Basic am9objpzZWNyZXQ=" | xargs echo
done
```