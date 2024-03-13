const { google, discord, facebook, vk } = require("../config/server.config.js").oauth;
const route = require("express").Router();
const passport = require("passport");

module.exports = app => {
  route.get('/vk', passport.authenticate('vkontakte', { scope: vk.scope }));
  route.get('/vk/callback', passport.authenticate('vkontakte', { successRedirect: '/', failureRedirect: '/'}));

  route.get('/google', passport.authenticate('google', { scope: google.scope }));
  route.get('/google/callback', passport.authenticate('google', { successRedirect: '/', failureRedirect: '/'}));

  route.get('/discord', passport.authenticate('discord', { scope: discord.scope }));
  route.get('/discord/callback', passport.authenticate('discord', { successRedirect: '/', failureRedirect: '/'}));

  route.get('/facebook', passport.authenticate('facebook'));
  route.get('/facebook/callback', passport.authenticate('facebook', { successRedirect: '/', failureRedirect: '/'}));

  route.get('/logout', async (req, res) => {
    const { id, isGuest } = req.session.passport.user;

    if(!isGuest){
      const game = await req.store.getPlayerDependenceById(id, 'game'), room = await req.store.getPlayerDependenceById(id, 'room');
      if(!game && !room) req.logout();
    }
    res.redirect('/');
  });

  return route;
}
