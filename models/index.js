const { db, user, password, server } = require("../config/server.config.js").mysql;

const Sequelize = require("sequelize");
const sequelize = new Sequelize(db, user, password, server);

const userModel = require("./user.model.js")(sequelize, Sequelize);

module.exports = { user: userModel, Sequelize, sequelize };
