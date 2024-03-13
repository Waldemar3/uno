module.exports = {
  host: 'localhost',
  port: 3000,

  https: false,

  mysql: {
    db: "uno",
    user: "root",
    password: "789905555v",

    server: {
      host: "localhost",
      dialect: "mysql",
      operatorsAliases: false,
    }
  },

  redis: {
    server: {
      host: "localhost",
      port: 6379,
    },
    cookie: {
      maxAge: 24*60*60*1000,
      httpOnly: true
    },
  },

  oauth: {
    vk: {
      clientID: '51445570',
      clientSecret: 'oII31SBWml9gJDHtLh2d',
      callbackURL: 'oauth/vk/callback',
      scope: ['profile', 'email'],
    },
    google: {
      clientID: '6572564168-c1ifd81kakv8j63m1u8o0sogvr2lstqn.apps.googleusercontent.com',
      clientSecret: '-tJ2O0sqmpiFtnpxLOWrYz5z',
      callbackURL: 'oauth/google/callback',
      scope: ['profile', 'email'],
    },
    discord:{
      clientID: '752131771298087013',
      clientSecret: 'DdKY5I7jpjCywUJ0pZq_YetM5vO-fddq',
      callbackURL: 'oauth/discord/callback',
      scope: ['identify', 'email'],
    },
    facebook:{
      clientID: '640353860978359',
      clientSecret: 'db4634db2cc92105700df1cb1253fa22',
      callbackURL: 'oauth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture'],
    },
  },

  ttl: {
    player: 10*60*60,
    room: 8*60*60,
    game: 3*60*60,
    afk: 20 * 60,

    timeToStep: 30,
    crashGameEnd: 10,
    timeForBan: 10*60,

    specialInvitation: 20,
    regularInvitation: 5,
  },

  link: function(){
    return this.https ? `https://${this.host}/` : `http://${this.host}:${this.port}/`;
  },
};
