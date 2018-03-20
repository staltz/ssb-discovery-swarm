import net = require('net');
import createDebug = require('debug');
import * as Rx from 'rxjs';
const swarm = require('discovery-swarm');
const pkg = require('../package.json');

const version = pkg.version;
const debug = createDebug(pkg.name);
const DEFAULT_PORT = 8007;
const DEFAULT_PREFIX = pkg.name;
const DEFAULT_MAX_PEERS = 3;

// Convert to ComVer:
const localVersion = (/^(\d+\.\d+)\.\d+$/.exec(version) as RegExpExecArray)[1];

type PeerInfo = {
  id: Buffer | string;
  host: string;
  port: string | number;
};

type SwarmPeer = {
  listen(port: number): void;
  join(key: string, opts: any, cb: Function): void;
  on(
    event: 'connection',
    cb: (connection: net.Socket, info: PeerInfo) => void,
  ): void;
};

type SSBPeer = {
  host: string;
  state: string;
};

type SBot = {
  gossip: {
    peers: () => Array<any>;
  };
  invite: {
    create: (num: number, cb: Function) => void;
    accept: (invitation: string, cb: Function) => void;
  };
};

type Config = {
  host: string;
  swarm: {
    port?: number;
    maxPeers?: number;
    prefix?: string;
    _peer?: SwarmPeer;
  };
};

type Conf = {
  host: string;
  swarm: {
    port: number;
    maxPeers: number;
    prefix: string;
    _peer?: SwarmPeer;
  };
};

const createInvitation$ = (sbot: SBot) =>
  Rx.Observable.bindNodeCallback<any>(sbot.invite.create);

const expectingMore = (sbot: SBot, conf: Conf) => () =>
  sbot.gossip.peers().filter(connectedPub).length < conf.swarm.maxPeers;

const createLocalPeer = (conf: Conf) => (invitation: string): SwarmPeer => {
  const peer: SwarmPeer =
    conf.swarm._peer ||
    swarm({
      maxConnections: 1000,
      utp: true,
      id: `${conf.swarm.prefix}@${localVersion}##${invitation}`,
    });
  peer.listen(conf.swarm.port);
  peer.join('ssb-discovery-swarm', { announce: true }, function() {
    debug('Joining discovery swarm under the channel "ssb-discovery-swarm"');
  });
  return peer;
};

function remotePeer$(peer: SwarmPeer): Rx.Observable<PeerInfo> {
  return Rx.Observable.create(function subscribe(
    observer: Rx.Observer<PeerInfo>,
  ) {
    try {
      peer.on('connection', function(connection: net.Socket, info: PeerInfo) {
        observer.next(info);
      });
    } catch (e) {
      observer.error(e);
    }
  });
}

function isCompatibleRemotePeer(conf: Conf) {
  /**
   * Checks whether the remote peer is compatible with the local peer,
   * whether they are meant for the same purpose.
   * @param remoteInfo
   */
  return function compatibleRemotePeer(remoteInfo: PeerInfo): boolean {
    const remoteId = (remoteInfo.id as Buffer).toString('ascii');
    const hasSamePrefix = remoteId.indexOf(conf.swarm.prefix + '@') === 0;
    const isHostLocal = remoteInfo.host === conf.host;
    const invitation = extractInvitation(remoteInfo);
    const isInvitationLocal =
      !!invitation && invitation.split(':')[0] === conf.host;
    return hasSamePrefix && !isHostLocal && !isInvitationLocal;
  };
}

/**
 * Checks whether the remote discovery peer has a valid (non-null) host.
 * @param remoteInfo
 */
function validHost(remoteInfo: PeerInfo): boolean {
  return !!remoteInfo.host;
}

/**
 * Checks whether the remote version matches the local version.
 * @param remoteInfo
 */
const versionsMatch = (conf: Conf) => (remoteInfo: PeerInfo) => {
  const remoteId = (remoteInfo.id as Buffer).toString('ascii');
  const remoteVersion = remoteId.split(conf.swarm.prefix + '@')[1];
  const remoteMajorVer = remoteVersion.split('.')[0];
  const localMajorVer = localVersion.split('.')[0];
  return remoteMajorVer === localMajorVer;
};

function peerHasInvitation(remoteInfo: PeerInfo): boolean {
  return !!extractInvitation(remoteInfo);
}

function extractInvitation(remoteInfo: PeerInfo): string | undefined {
  const remoteId = (remoteInfo.id as Buffer).toString('ascii');
  const remoteInvitation = remoteId.split('##')[1];
  return remoteInvitation;
}

function connectedPub(peer: SSBPeer): boolean {
  return peer.state === 'connected';
}

/**
 * Checks whether the remote peer isnt yet in the locally-known connected pubs.
 * @param remoteInfo
 */
function isNewRemotePeer(remoteInfo: PeerInfo, pubs: Array<SSBPeer>): boolean {
  return pubs.filter(connectedPub).every(pub => pub.host !== remoteInfo.host);
}

/**
 * Sets up and runs a discovery swarm peer. Either takes a peer as input in opts
 * or creates a peer from scratch.
 * @param {Options} opts
 */
function init(sbot: SBot, config: Config) {
  if (!config.swarm) config.swarm = {};
  if (!config.swarm.port) config.swarm.port = DEFAULT_PORT;
  if (!config.swarm.maxPeers) config.swarm.maxPeers = DEFAULT_MAX_PEERS;
  if (!config.swarm.prefix) config.swarm.prefix = DEFAULT_PREFIX;
  const conf: Conf = config as Conf;

  createInvitation$(sbot)(9999)
    .do(inv => debug(`Created invitation ${inv}`))
    .map(createLocalPeer(conf))
    .concatMap(remotePeer$)
    .do(info => debug(`(Found random DHT peer ${info.host} ${info.id})`))
    .filter(expectingMore(sbot, conf))
    .filter(validHost)
    .filter(isCompatibleRemotePeer(conf))
    .filter(peerHasInvitation)
    .filter(versionsMatch(conf))
    .filter(info => isNewRemotePeer(info, sbot.gossip.peers()))
    .do(p =>
      debug('Discovered valid peer %s:%s (id: %s)', p.host, p.port, p.id),
    )
    .mergeMap(inf => Rx.Observable.of(extractInvitation(inf)).filter(x => !!x))
    .subscribe({
      next: (invitation: string) => {
        debug(`Attemping to use invitation ${invitation} ...`);
        sbot.invite.accept(invitation, (err: any, d: any) => {
          if (err) debug(`Failure, invitation was rejected:`, err);
          else debug(`Successfully claimed invitation ${invitation}`);
        });
      },
      error: e => console.log(e),
    });
}

export = {
  name: 'discovery-swarm',
  version: pkg.version,
  init: init,
};
