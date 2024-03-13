const serverConfig = require('./config/server.config.js'),
      { host, port, corsSettings } = serverConfig;

const { session, redis } = require('./controllers/redis.controller.js'),
      minify = require('./controllers/minifier.controller.js'),
      store = require('./controllers/Store.controller.js'),
      oauth = require("./controllers/oauth.controller.js"),
      websocket = require('./websocket/index.js'),
      db = require('./models/index.js');

const passport = require("passport"),
      express = require('express'),
      cors = require('cors');

passport.use(oauth.guest());
passport.use(oauth.google());
passport.use(oauth.discord());
passport.use(oauth.facebook());
passport.use(oauth.vk());

passport.serializeUser(oauth.serialize);
passport.deserializeUser(oauth.deserialize);

let app = express(),
    http = require('http').createServer(app);

app.use(cors({
  origin: serverConfig.link(),
  optionsSuccessStatus: 200,
}));

app.use(express.static('public'));

app.use(session);
app.use(store(redis, db));

app.use(passport.initialize());
app.use(passport.session());

app.use('/', require('./routes/index.router.js')(app));
app.use('/oauth', require('./routes/oauth.router.js')(app));

websocket(http);

minify.js(
  'index.js',
  __dirname+'/public/js',
  __dirname+'/public/app.js',
  [
    `const config = JSON.parse('${JSON.stringify(require('./config/uno.config.js'))}');`,
    minify.templates(__dirname+'/public/templates'),
  ]
);
minify.css(__dirname+'/public/css', __dirname+'/public/app.css');

db.sequelize.sync().then(()=>http.listen(port, host));
