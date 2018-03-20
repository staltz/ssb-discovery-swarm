# ssb-discovery-swarm

> A Scuttlebot plugin that exchanges invites with other sbots in a DHT

Every (internet) sbot which has this plugin installed will look for each other using `discovery-swarm` (backed by a Distributed Hash Table, DHT) and will exchange invites to follow each other.

**Note: this is an experimental plugin** and may cause strangers to replicate each other's feeds. The use of a DHT in Scuttlebutt still requires proper consideration and design.

## Usage

```diff
 const createSbot = require('scuttlebot/index')
   .use(require('scuttlebot/plugins/plugins'))
   .use(require('scuttlebot/plugins/master'))
   .use(require('scuttlebot/plugins/gossip'))
   .use(require('scuttlebot/plugins/replicate'))
   .use(require('ssb-friends'))
   .use(require('ssb-blobs'))
   .use(require('ssb-backlinks'))
   .use(require('ssb-private'))
   .use(require('ssb-about'))
   .use(require('ssb-contacts'))
   .use(require('ssb-query'))
+  .use(require('ssb-discovery-swarm'))
   .use(require('scuttlebot/plugins/invite'))
   .use(require('scuttlebot/plugins/block'))
   .use(require('scuttlebot/plugins/local'))
```

You can configure the parameters for this plugin through the ssb config object. All parameters are optional and have default values, so manual configuration is not strictly required:

```diff
 var config = {
   // ...
+  swarm: {
+    port: 8007, // port to use in the swarm
+    maxPeers: 3, // maximum number of peers to connect with simultaneously
+    prefix: 'ssb-stuff', // id string to use to discover other compatible peers
+  },
   // ...
 }
```

## Install

```
npm install --save ssb-discovery-swarm
```

## License

MIT
