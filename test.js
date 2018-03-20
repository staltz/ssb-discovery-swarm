var test = require('tape');
var pull = require('pull-stream');
var ssbKeys = require('ssb-keys');
var plugin = require('./lib/index');

var fakeInviteCalled = false;
var fakeInvitePlugin = {
  name: 'invite',
  version: '1.0.0',
  manifest: {
    invite: 'async',
  },
  init: function() {
    return {
      create: () => {
        fakeInviteCalled = true;
      },
    };
  },
};

var CreateTestSbot = require('scuttle-testbot')
  .use(require('scuttlebot/plugins/plugins'))
  .use(require('scuttlebot/plugins/master'))
  .use(fakeInvitePlugin)
  .use(require('scuttlebot/plugins/gossip'))
  .use(plugin);

var lucyKeys = ssbKeys.generate();

test('works as an sbot plugin', function(t) {
  t.plan(2);
  t.equals(fakeInviteCalled, false, 'sbot.invite.create not yet called');
  var myTestSbot = CreateTestSbot({
    name: 'test1',
    keys: lucyKeys,
    host: 'alice.com',
  });
  var lucy = myTestSbot.createFeed(lucyKeys);

  setTimeout(() => {
    t.equals(fakeInviteCalled, true, 'sbot.invite.create was called');
    myTestSbot.close();
    t.end();
  }, 300);
});

test('should allow Alice to find Bob and get an invite', function(t) {
  t.plan(3);
  const prefix = 'ssb-discovery-swarm';
  const swarmPort = 4001;

  const ssbBotA = {
    invite: {
      create: (amount, cb) => {
        t.pass('Alice creates invitation');
        cb(null, 'AliceInvitesYou');
      },
      accept: (invitation, cb) => {
        t.equals(invitation, 'BobInvitesYou', "Alice uses Bob's invitation");
        cb(null, true);
      },
    },
    gossip: {
      peers: () => [],
    },
  };

  const peerA = {
    listen: port => {},
    join: (key, opts, cb) => {},
    on: (event, cb) => {
      const peerInfoB = {
        id: prefix + '@1.0.0##BobInvitesYou',
        host: 'bob.com',
        port: swarmPort,
      };
      t.pass('Alice discovered Bob in the DHT');
      cb(null, peerInfoB);
    },
  };

  const ssbConf = {
    host: 'alice.com',
    swarm: {
      port: swarmPort,
      prefix: prefix,
      _peer: peerA,
    },
  };

  plugin.init(ssbBotA, ssbConf);
});

test('should make Alice ignore Bob if already connected', function(t) {
  t.plan(2);
  const prefix = 'ssb-discovery-swarm';
  const swarmPort = 4001;

  const ssbBotA = {
    invite: {
      create: (amount, cb) => {
        t.pass('Alice creates invitation');
        cb(null, 'AliceInvitesYou');
      },
      accept: (invitation, cb) => {
        t.fail("Alice should not use Bob's invitation");
        cb(null, true);
      },
    },
    gossip: {
      peers: () => [{ host: 'bob.com', state: 'connected' }],
    },
  };

  const peerA = {
    listen: port => {},
    join: (key, opts, cb) => {},
    on: (event, cb) => {
      const peerInfoB = {
        id: prefix + '@1.0.0##BobInvitesYou',
        host: 'bob.com',
        port: swarmPort,
      };
      t.pass('Alice discovered Bob in the DHT');
      cb(null, peerInfoB);
    },
  };

  const ssbConf = {
    host: 'alice.com',
    swarm: {
      port: swarmPort,
      prefix: prefix,
      _peer: peerA,
    },
  };

  plugin.init(ssbBotA, ssbConf);
});

test('should make Alice ignore Bob if already connected to max', function(t) {
  t.plan(2);
  const prefix = 'ssb-discovery-swarm';
  const swarmPort = 4001;

  const ssbBotA = {
    invite: {
      create: (amount, cb) => {
        t.pass('Alice creates invitation');
        cb(null, 'AliceInvitesYou');
      },
      accept: (invitation, cb) => {
        t.fail("Alice should not use Bob's invitation");
        cb(null, true);
      },
    },
    gossip: {
      peers: () => [
        { host: 'test1.local', state: 'connected' },
        { host: 'test2.local', state: 'connected' },
        { host: 'test3.local', state: 'connected' },
        { host: 'test4.local', state: 'connected' },
      ],
    },
  };

  const peerA = {
    listen: port => {},
    join: (key, opts, cb) => {},
    on: (event, cb) => {
      const peerInfoB = {
        id: prefix + '@1.0.0##BobInvitesYou',
        host: 'bob.com',
        port: swarmPort,
      };
      t.pass('Alice discovered Bob in the DHT');
      cb(null, peerInfoB);
    },
  };

  const ssbConf = {
    host: 'alice.com',
    swarm: {
      port: swarmPort,
      prefix: prefix,
      max: 3,
      _peer: peerA,
    },
  };

  plugin.init(ssbBotA, ssbConf);
});

test('should make Alice ignore Bob if different versions', function(t) {
  t.plan(2);
  const prefix = 'ssb-discovery-swarm';
  const swarmPort = 4001;

  const ssbBotA = {
    invite: {
      create: (amount, cb) => {
        t.pass('Alice creates invitation');
        cb(null, 'AliceInvitesYou');
      },
      accept: (invitation, cb) => {
        t.fail("Alice should not use Bob's invitation");
        cb(null, true);
      },
    },
    gossip: {
      peers: () => [],
    },
  };

  const peerA = {
    listen: port => {},
    join: (key, opts, cb) => {},
    on: (event, cb) => {
      const peerInfoB = {
        id: prefix + '@0.0.0##BobInvitesYou',
        host: 'bob.com',
        port: swarmPort,
      };
      t.pass('Alice discovered Bob in the DHT');
      cb(null, peerInfoB);
    },
  };

  const ssbConf = {
    host: 'alice.com',
    swarm: {
      port: swarmPort,
      prefix: prefix,
      _peer: peerA,
    },
  };

  plugin.init(ssbBotA, ssbConf);
});

test('should make Alice ignore Bob if different prefix', function(t) {
  t.plan(2);
  const prefix = 'ssb-discovery-swarm';
  const swarmPort = 4001;

  const ssbBotA = {
    invite: {
      create: (amount, cb) => {
        t.pass('Alice creates invitation');
        cb(null, 'AliceInvitesYou');
      },
      accept: (invitation, cb) => {
        t.fail("Alice should not use Bob's invitation");
        cb(null, true);
      },
    },
    gossip: {
      peers: () => [],
    },
  };

  const peerA = {
    listen: port => {},
    join: (key, opts, cb) => {},
    on: (event, cb) => {
      const peerInfoB = {
        id: 'alien-prefix@1.0.0##BobInvitesYou',
        host: 'bob.com',
        port: swarmPort,
      };
      t.pass('Alice discovered Bob in the DHT');
      cb(null, peerInfoB);
    },
  };

  const ssbConf = {
    host: 'alice.com',
    swarm: {
      port: swarmPort,
      prefix: prefix,
      _peer: peerA,
    },
  };

  plugin.init(ssbBotA, ssbConf);
});
