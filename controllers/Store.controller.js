const { ttl, nicknameLength, regexp } = require("../config/uno.config.js");
const { v4: uuidv4 } = require('uuid');

class Store {
  constructor(redis, db){
    this.db = db;
    this.redis = redis;
  }

  async initPlayer({ id, isGuest }, socketId){
    const player = await this.getPlayerById(id, ['authorized', 'socketId', 'ban']);
    const [ auth ] = player;

    if(!auth){
      const authorized = !isGuest ? JSON.stringify( await this.getUserById(id, [ 'nickname', 'picture' ]) ) : 'none';

      this.redis.pipeline().hmset(`player:${id}`, { authorized, socketId }).expire(`player:${id}`, ttl.player).exec();

      return [ authorized ];
    }

    this.redis.pipeline().hset(`player:${id}`, { socketId }).expire(`player:${id}`, ttl.player).exec();

    return player;
  }

  createInvitation(invited, inviter){
    return this.redis.createInvitation(invited, inviter, ttl.specialInvitation);
  }

  cancelInvitation(id){
    this.redis.del(`invite:${id}`);
  }

  addPlayerToRoom(id){
    return this.redis.addPlayerToRoom(id, uuidv4(), ttl.room);
  }

  changeLeader(id, leaderNumber){
    return this.validateNumber(leaderNumber, 0, 3) && this.redis.changeLeader(id, leaderNumber, ttl.room);
  }

  kick(id, kickNumber){
    return this.validateNumber(kickNumber, 0, 3) && this.redis.kick(id, kickNumber, ttl.room);
  }

  leave(id){
    return this.redis.leave(id, ttl.room);
  }

  gameSearch(id, numberOfPlayers, search = true){
    return this.validateNumber(numberOfPlayers, 2, 4) && this.redis.gameSearch(id, numberOfPlayers, uuidv4(), ttl.game, Date.now(), search);
  }
  updateGame(id, gameId, updateObject){
    return this.redis.updateGame(id, gameId, JSON.stringify(updateObject));
  }
  saveGame(game, gameId){
    return this.redis.set(`game:${gameId}`, JSON.stringify(game));
  }

  setGameCards(mode, cards){
    this.redis.set(`gameCards:${mode}`, JSON.stringify(cards));
  }
  async getGameCards(mode){
    const gameCards = await this.redis.get(`gameCards:${mode}`)
    return JSON.parse(gameCards);
  }

  async getPlayerDependenceById(playerId, playerDependence){
    const dependenceId = await this.redis.hget(`player:${playerId}`, `${playerDependence}Id`);
    if(!dependenceId) return false;

    const dependence = await this.redis.get(`${playerDependence}:${dependenceId}`);
    if(dependence) return { [playerDependence]: JSON.parse(dependence), [`${playerDependence}Id`]: dependenceId };

    this.redis.hdel(`player:${playerId}`, `${playerDependence}Id`);
    return false
  }
  removeDependence(id, dependence){
    this.redis.del(`${dependence}:${id}`);
  }
  removeFromQueue(id){
    this.redis.zrem(`queue`, id);
  }

  banPlayerById(id){
    this.redis.hset(`player:${id}`, 'ban', Date.now());
  }

  getUserById(id, attributes){
    return this.db.user.findOne({where: { id }, attributes, raw: true});
  }

  getUserByNickname(nickname, attributes){
    return this.db.user.findOne({where: { nickname }, attributes, raw: true});
  }

  getPlayerById(id, attributes = null){
    if(!attributes) return this.redis.hgetall(`player:${id}`);
    return this.redis.hmget(`player:${id}`, attributes);
  }

  async getPlayers(ids){
    const pipeline = this.redis.pipeline();

    ids.forEach(id => pipeline.hgetall(`player:${id}`));

    return (await pipeline.exec()).map((player, i) => ({ ...player[1], id: ids[i] }));
  }

  async authenticate(providerId, provider, nickname, picture, email, req){
    const { id, isGuest } = req.session.passport.user;

    if(!isGuest) return false;

    nickname = this.remakeNickname(nickname, email);

    if(!nickname) return false;

    const game = await this.getPlayerDependenceById(id, 'game');

    if(game) return false;

    const room = await this.getPlayerDependenceById(id, 'room');

    if(room) return false;

    this.redis.del(`player:${id}`);

    let user = await this.db.user.findOne({where: {[this.db.Sequelize.Op.and]: [{ providerId },{ provider }]}});
    if(!user){

      if(!email) email = null;

      if(email){
        const emailExist = await this.db.user.findOne({ where: { email } });
        if(emailExist) email = null;
      }

      const nicknameExist = await this.db.user.findOne({ where: { nickname } });

      if(nicknameExist){
        const last = await this.db.user.findOne({order: [['id', 'DESC']]});
        nickname = nickname+last.id;
      }

      user = await this.db.user.create({ providerId, provider, nickname, email, picture });
    }else{
      if(user.picture !== picture){
        this.db.user.update({ picture },{ where: { id: user.id } });

        const pictureExists = await this.redis.hexists(`player:${user.id}`, 'authorized');
        if(pictureExists) this.redis.del(`player:${user.id}`);
      }
    }

    return user.id;
  }

  remakeNickname(nickname, mail = false){
    if(typeof nickname !== 'string') return false;

    let remadeNickname = name => {
      let newName = name.replace(/[^a-zа-я0-9 ]/ig, '').replace(/\s+/g, ' ');
      return newName.length >= nicknameLength.min && newName;
    };

    nickname = remadeNickname(nickname);

    if(typeof mail === 'string' && mail && !nickname){
      let [ mailName, isMail ] = mail.split('@');
      if(isMail) nickname = remadeNickname(mailName);
    }

    return nickname;
  }

  validateName(name, min, max){
    return typeof name === 'string' && new RegExp(regexp.checkNickname).test(name) && name.length > min && name.length < max;
  }
  validateNumber(n, min, max){
    return Number.isInteger(n) && n >= min && n <= max;
  }
}

module.exports = (redis, db) => {
  return (req, res, next) => {
    req.store = new Store(redis, db);
    next();
  }
}
