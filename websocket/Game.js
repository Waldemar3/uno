const { nicknameLength, notice, guest, ttl, regexp } = require("../config/uno.config.js");

module.exports = class Game {
  constructor(options){

    this.timers = [];

    this.io = options.io;
    this.adapter = options.io.adapter;

    this.socket = options.socket;
    this.store = options.socket.request.store;

    this.user = options.socket.request.session.passport.user;

    this.modes = options.gameModes(options);

    this.init();
  }

  async init(){
    const { id, isGuest } = this.user;
    const [ authorized, oldSocketId, ban ] = await this.store.initPlayer(this.user, this.socket.id);

    if(ban && (Date.now()-ban+2000)/1000 <= ttl.timeForBan){
      this.socket.emit('ban:notice', ban);
      this.socket.disconnect(true);
      return;
    }

    if(oldSocketId){
      const oldSocketIdOnline = await this.online([oldSocketId]);

      if(oldSocketIdOnline){
        this.socket.to(oldSocketId).emit('disconnect:notice', '2');
        this.adapter.remoteDisconnect(oldSocketId, true);
      }
    }

    let room = !isGuest && await this.store.getPlayerDependenceById(id, 'room');

    if(room){
      const { roomId } = room;

      this.socket.join(roomId);

      room = await this.initRoom(room);

      this.socket.to(roomId).emit('room:player:connect', id);
    }

    let game = await this.store.getPlayerDependenceById(id, 'game');

    if(game){
      const { start, mode } = game.game;

      if(!start){
        this.socket.emit('forced:game:over:notice', lastUpdate);
        this.socket.on('forced:game:over', ()=>this.forcedGameOver());
        return;
      }

      game = await this.modes[mode].initGame(game);
    }

    this.socket.emit('init:player', { player: !isGuest ? { id, ...JSON.parse(authorized), alt: guest.picture } : { id, ...guest, authorized }, room, game } );

    if(!isGuest){
      this.socket.on('create:invite', name => this.createInvitation(name));
      this.socket.on('accept:invite', () => this.acceptInvitation());
      this.socket.on('cancel:invite', () => this.cancelInvitation());

      this.socket.on('change:leader', leaderNumber => this.changeLeader(leaderNumber));

      this.socket.on('kick', kickNumber => this.kick(kickNumber));
      this.socket.on('leave', () => this.leave());
    }

    this.socket.on('game:search:start', numberOfPlayers => this.gameSearchStart(numberOfPlayers));
    this.socket.on('game:search:cancel', () => this.gameSearchCancel());

    this.socket.on('step', card => this.step(card));

    this.socket.on('disconnect', () => this.disconnect());

    this.socket.on('forced:game:over', ()=>this.forcedGameOver());

    this.setAFKtimer();
  }

  async createInvitation(nickname){
    try{
      const { id: inviter } = this.user;
      const user = this.store.validateName(nickname, nicknameLength.min, nicknameLength.max*3) && await this.store.getUserByNickname(nickname, ['id']);

      if(!user){
        throw { SocketError: '0.2' }; // *Данного пользователя не существует
      }

      const { id: invited } = user;

      if(!invited || invited == inviter){
        throw { SocketError: '0.3' }; // *Вы не можете пригласить самого себя
      }

      const [invitedSocketId] = await this.store.getPlayerById(invited, ['socketId']);
      const invitedOnline = await this.online(invitedSocketId);

      if(!invitedOnline){
        throw { SocketError: '0.4' }; // * Пользователь не в сети
      }

      const invite = await this.store.createInvitation(invited, inviter);

      if(!invite) {
        throw { SocketError: '0.5' }; // * Пользователь уже имеет приглашение или активную комнату
      }

      this.socket.to(invitedSocketId).emit('invite', invite);
      this.socket.emit('successful:invite');

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async acceptInvitation(){
    try{
      const { id } = this.user;
      const joinedRoom = await this.store.addPlayerToRoom(id);

      if(!joinedRoom){
        throw { SocketError: '1.0' }; // * Комната переполнена или время ожидания приглашения вышло
      }

      const [ jsonRoom, roomId, inviter ] = joinedRoom;

      const room = JSON.parse(jsonRoom);

      const initRoom = await this.initRoom({ room, roomId });

      this.socket.join(roomId);

      this.socket.emit('init:room', initRoom);

      if(inviter) {
        const inviterSocketId = initRoom.players[room.players.indexOf(inviter)].socketId;
        await this.adapter.remoteJoin(inviterSocketId, roomId);
        this.socket.to(inviterSocketId).emit('init:room', initRoom);
      }else{
        const player = await this.store.getPlayerById(id);
        this.socket.to(roomId).emit('room:player:join', { ...player, id, online: true });
      }

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  cancelInvitation(){
    try{
      this.store.cancelInvitation(this.user.id);

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async changeLeader(leaderNumber){
    try{
      const { id } = this.user;
      const newLeader = await this.store.changeLeader(id, Number(leaderNumber));

      if(!newLeader) return;

      const [ roomId, leaderId ] = newLeader;

      this.io.to(roomId).emit('room:change:leader', leaderId);

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async kick(kickNumber){
    try{
      const { id } = this.user;
      const kick = await this.store.kick(id, Number(kickNumber));

      if(!kick) return;

      const [ roomId, kickId ] = kick;

      const [ socketId ] = await this.store.getPlayerById(kickId, ['socketId']);

      const kickOnline = await this.online(socketId);

      if(kickOnline){
        await this.adapter.remoteLeave(socketId, roomId);
      }

      this.io.to(roomId).emit('room:player:leave', kickId);

      this.socket.to(socketId).emit('notice', '1.1');
      this.socket.to(socketId).emit('room:leave');

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async leave(){
    try{
      const { id } = this.user;
      const roomId = await this.store.leave(id);

      if(!roomId) return;

      this.socket.leave(roomId);

      this.socket.emit('room:leave');
      this.socket.to(roomId).emit('room:player:leave', id);

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async gameSearchStart(numbers){
    try{
      const { id, isGuest } = this.user;

      if(!(new RegExp(regexp.startGameNumbers).test(numbers))) return;

      const [ numberOfPlayers, mode ] = numbers.split(':');

      if(!this.modes[mode]) return;

      const gameCreated = await this.modes[mode].createGame(numberOfPlayers);
      if(gameCreated) return;

      const room = !isGuest && await this.store.getPlayerDependenceById(id, 'room');

      if(room){
        this.io.to(room.roomId).emit('game:search:start');
        return;
      }

      this.socket.emit('game:search:start');

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async gameSearchCancel(){
    try{
      const { id, isGuest } = this.user;

      const room = !isGuest && await this.store.getPlayerDependenceById(id, 'room');

      if(room){
        const { roomId } = room;

        this.store.removeFromQueue(roomId);
        this.io.to(roomId).emit('game:search:cancel');
        return;
      }

      this.store.removeFromQueue(id);
      this.socket.emit('game:search:cancel');

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async forcedGameOver(){
    const { id } = this.user, game = await this.store.getPlayerDependenceById(id, 'game');

    if(game){
      const { players, start, lastUpdate, lastStep } = game.game;

      if(!start){
        if(ttl.crashGameEnd-(Date.now()-lastUpdate)/1000 <= 0){
          this.store.removeDependence(game.gameId, 'game');
          this.socket.emit('reload');
        }
        return;
      }
      if(Date.now()-lastUpdate >= ttl.timeToStep*1000){
        this.store.removeDependence(game.gameId, 'game');
        this.store.banPlayerById(players[lastStep].id);
        this.io.to(game.gameId).emit('reload');
      }
    }
  }

  async step(card){
    try{
      const { id } = this.user, gameExists = await this.store.getPlayerDependenceById(id, 'game');
      if(!gameExists) return;

      this.modes[gameExists.game.mode].step(card, gameExists);

      this.resetTimer('afk');
      this.setAFKtimer();
    }catch(e){
      this.errorHandler(e);
    }
  }

  async disconnect(){
    const { id, isGuest } = this.user;

    const room = !isGuest && await this.store.getPlayerDependenceById(id, 'room');

    if(room){
      const { roomId } = room;

      this.socket.to(roomId).emit('room:player:disconnect', id);

      const onlinePlayers = await this.io.in(roomId).fetchSockets();

      if(onlinePlayers.length == 0) this.store.removeDependence(roomId, 'room');

      this.io.to(roomId).emit('game:search:cancel');

      this.store.removeFromQueue(roomId);
    }

    this.store.removeFromQueue(id);

    this.resetTimer('afk');
  }

  async initRoom(room){
    const { players: ids, leader } = room.room;

    const players = await this.store.getPlayers(ids);

    const sockets = await this.onlinePlayers(players);

    players.forEach((player, i) => players[i].online = sockets.indexOf(player.socketId) !== -1);

    return { players, leader };
  }

  async online(socket){
    return (await this.io.in(socket).fetchSockets()).length !== 0;
  }
  async onlinePlayers(players){
    return (await this.io.in(players.map(({socketId}) => socketId)).fetchSockets()).map(({id})=>id);
  }

  setAFKtimer(){
    this.timers['afk'] = setTimeout(() => {
      this.socket.emit('disconnect:notice', '1');
      this.socket.disconnect(true);
    }, ttl.afk*1000);
  }

  resetTimer(type){
    const timer = this.timers[type];
    if(timer) clearTimeout(timer);
  }

  errorHandler(e){
    if(e.hasOwnProperty('SocketError')){
      this.socket.emit('notice', e.SocketError);
    }else{
      console.log(e);
    }
  }
}
