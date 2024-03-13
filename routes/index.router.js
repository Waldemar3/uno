const route = require("express").Router();
const passport = require("passport");
const path = require("path");

module.exports = app => {
  route.get("/", authentication, (req, res) => res.sendFile(path.resolve('./public/main.html')));

  return route;
}

const authentication = (req, res, next) => !req.isAuthenticated() ? passport.authenticate('custom')(req, res, next) : next();
