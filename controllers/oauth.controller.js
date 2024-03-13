const serverConfig = require("../config/server.config.js"), { https, host, port, oauth } = serverConfig, { google, discord, facebook, vk } = oauth;

const { v4: uuidv4 } = require('uuid');

const GuestStrategy = require('passport-custom').Strategy;
const VkontakteStrategy = require('passport-vk').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth2').Strategy;

module.exports = {
  guest: () => new GuestStrategy((_, done) => done(null, {id: uuidv4(), isGuest: true})),

  vk: () => new VkontakteStrategy({ ...vk, callbackURL: serverConfig.link()+vk.callbackURL, passReqToCallback: true }, async (req, accessToken, refreshToken, { email }, { id, provider, displayName, photos, _json }, done) => {
    const userId = await req.store.authenticate(id, provider, displayName, photos && photos[0].value, email, req);

    done(null, userId && { id: userId, isGuest: false });
  }),

  google: () => new GoogleStrategy({ ...google, callbackURL: serverConfig.link()+google.callbackURL, passReqToCallback: true }, async (req, accessToken, refreshToken, { id, provider, displayName, picture, email }, done) => {
    const userId = await req.store.authenticate(id, provider, displayName, picture, email, req);

    done(null, userId && { id: userId, isGuest: false });
  }),

  discord: () => new DiscordStrategy({ ...discord, callbackURL: serverConfig.link()+discord.callbackURL, passReqToCallback: true }, async (req, accessToken, refreshToken, { id, provider, username, avatar, email }, done) => {
    const userId = await req.store.authenticate(id, provider, username, `https://cdn.discordapp.com/avatars/${id}/${avatar}`, email, req);

    done(null, userId && { id: userId, isGuest: false });
  }),

  facebook: () => new FacebookStrategy({ ...facebook, callbackURL: serverConfig.link()+facebook.callbackURL, passReqToCallback: true }, async (req, accessToken, refreshToken, { provider, _json }, done) => {
    const { id, first_name, last_name, picture, email } = _json,
          userId = await req.store.authenticate(id, provider, first_name+' '+last_name, picture.data.url, email, req);

    done(null, userId && { id: userId, isGuest: false });
  }),

  serialize: (user, done) => done(null, user),
  deserialize: (user, done) => done(null, user),
};
