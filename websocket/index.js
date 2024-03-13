const { session, redis } = require('../controllers/redis.controller.js'),
      store = require('../controllers/Store.controller.js'),
      db = require('../models/index.js');

const { createAdapter } = require('@socket.io/redis-adapter'),
      { Emitter } = require('@socket.io/redis-emitter'),
      { Server } = require('socket.io'),
      passport = require("passport");

const Game = require('./Game.js');
const gameModes = require('./GameModes/index.js');

module.exports = (http) => {
  const io = new Server(http, {transports: [ 'websocket' ]}),
        emitter = (new Emitter(redis)).of('/');

  io.adapter(createAdapter(redis, redis.duplicate()));

  const uno = io.of('/')
              .use(wrap(session))
              .use(wrap(store(redis, db)))
              .use(wrap(passport.initialize()))
              .use(wrap(passport.session()))
              .use(verification);

  uno.on('connection', socket => new Game({ io: uno, gameModes, emitter, socket }));
}

const verification = (socket, next) => socket.request.isAuthenticated() ? next() : false;
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
