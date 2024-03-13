const { modes, guest, robot, regexp, gameOptions } = require("../../config/uno.config.js");

const Default = require('./Default.js');

const { v4: uuidv4 } = require('uuid');

module.exports = class Computer extends Default {
  constructor(options){
    super(options);

    this.modeConfig = modes['Default'];
  }

  async initGame({ game: { players, lastCard, lastStep, lastUpdate, start, firstStep, direction }, gameId }){
    const { id, isGuest } = this.user;

    this.socket.join(gameId);

    players.forEach(({id: cardsId, cards},i) => players[i].cards = id != cardsId ? cards.length : cards);

    return { players: this.renameGuests(players), lastCard, lastStep, lastUpdate, start, firstStep, direction };
  }

  async createGame(numberOfPlayers){
    const { cardWithoutColor, numberOfPlayerCards } = this.modeConfig;
    const { id, isGuest } = this.user;

    const game = await this.store.gameSearch(id, Number(numberOfPlayers), 'none');

    if(game){
      const [ ids, gameId ] = game;

      let players = await this.store.getPlayers(ids), numberOfRobots = numberOfPlayers-players.length;

      for(let i = 0; i < numberOfRobots; i++){
        players.push({id: uuidv4(), type: 'bot'});
      }

      players = this.renameGuests(players);

      for(const [i, player] of players.entries()){
        players[i].cards = await this.getRandomCards(numberOfPlayerCards);
      }

      const lastUpdate = Date.now(),
            lastCard = (await this.getRandomCards(1))[0],
            lastStep = Math.floor(Math.random()*players.length);

      const gameObj = {lastCard, lastStep, lastUpdate, start: lastUpdate, previousStep: lastStep, firstStep: true, direction: true, mode: 1 };

      await this.store.saveGame({ ...gameObj, players, cards: this.cards }, gameId);

      players.forEach(({socketId}) => socketId && this.emitter.to(socketId).socketsJoin(gameId));

      players.forEach(({id: ID, socketId}) => socketId && this.io.to(socketId).emit('init:game', { ...gameObj, players: players.map(player => ({...player, cards: ID != player.id ? numberOfPlayerCards : player.cards})) }));

      if(players[lastStep].type === 'bot') await this.step(lastCard[0] === cardWithoutColor ? this.colorForSpecialCard(lastCard) : lastCard, { game: { ...gameObj, players, cards: this.cards }, gameId });

      return this;
    }
    return false;
  }

  async step(step, gameObject){
    let { id } = this.user,
        { regular, special, events, cardWithoutColor, maxNumberOfCardsInDeck } = this.modeConfig,
        isSpecialCard = special.cards.indexOf(step[1]) !== -1,
        isRegularCard = regular.cards.indexOf(step[1]) !== -1,
        colorExist = regular.colors.indexOf(step[0]) !== -1,
        isEvent = events.indexOf(step) !== -1 && step;

    let { game, gameId } = gameObject, { players, start, lastStep, previousStep, lastCard, firstStep, unoSaid } = game;

    id = players[lastStep].id !== id ? players[lastStep].id : id;

    if(typeof step !== 'string' || !(new RegExp(regexp.checkCard).test(step)) || (!isSpecialCard && !isRegularCard && !isEvent) || (!isEvent && !colorExist)) return;

    const [ card, cardIndex ] = step.split(':'), reworkedCard = isSpecialCard && !isEvent ? cardWithoutColor+card[1] : card;

    if(firstStep && reworkedCard !== lastCard) return;

    let cards = players[lastStep].cards;

    if(isEvent === 'tc' && cards.length >= maxNumberOfCardsInDeck) return;

    if(!isEvent && !firstStep){
      if(!(this.compareCards(lastCard, card) || isSpecialCard) || cards[cardIndex] !== reworkedCard){
        this.socket.emit('cancel:step');
        return;
      }

      cards.splice(cardIndex, 1);
    }

    game = await (!isEvent ? (this[card[1]] ?? this['r']) : this[card]).call(this, { ...game, lastCard: isEvent ? lastCard : card, lastUpdate: Date.now(), previousStep: lastStep, firstStep: false, unoSaid: false, didntSayUnoStep: !unoSaid && players[previousStep].cards.length === 1 && isEvent === 'du' ? previousStep : false });
    const gameSaved = await this.store.updateGame(id, gameId, { ...game, newCards:undefined, socketId:undefined });

    if(!gameSaved) {
      if(!isEvent) this.socket.emit('cancel:step');
      return;
    }

    const { newCards, socketId } = game;
    step = { ...game, id, newCards, isEvent, firstStep, players:undefined, cards:undefined };

    if(cards.length === 0){
      this.store.removeDependence(gameId, 'game');
      this.emitter.to(gameId).emit('end:game', id);
    }

    if(newCards){
      const except = socketId || players[lastStep].type === 'bot' ?
            (()=> (this.emitter.to(socketId).emit('step', step), socketId))() :
            (()=> (this.socket.emit('step', step), this.socket.id))();
      this.emitter.to(gameId).except(except).emit('step', { ...step, newCards: newCards.length });
    }else{
      this.emitter.to(gameId).emit('step', step);
    }

    const player = game.players[game.lastStep], except = [this.socket.id];

    if(player.cards.length === 2 && isEvent !== 'su'){
      const socketId = await this.store.getPlayerById(player.id, ['socketId']);
      this.emitter.to(socketId).emit('say:uno');
      except.push(socketId[0]);
    }
    if(!unoSaid && cards.length === 1 && isEvent !== 'du') this.emitter.to(gameId).except(except).emit('didnt:say:uno');

    const nextPlayer = players[game.lastStep];

    if(nextPlayer.type === 'bot'){
      let hasCard = null;

      for(const [i, card] of nextPlayer.cards.entries()) if(this.compareCards(card, game.lastCard) || this.isSpecialCard(card)){
        hasCard = (card[0] === cardWithoutColor ? this.colorForSpecialCard(card) : card)+':'+i;
        break;
      }

      setTimeout(()=>this.step(
        player.cards.length === 2 && isEvent !== 'su' && hasCard ? 'su' : !unoSaid && cards.length === 1 && isEvent !== 'du' ? 'du' : hasCard || 'tc',
        { game: { ...game, newCards:undefined, socketId:undefined }, gameId }),
        gameOptions.robotStepDelay
      );
    }
  }

  renameGuests(players){
    players.forEach((player, i) => {if(player.authorized === 'none') players[i].authorized = JSON.stringify(guest); if(player.type === 'bot') players[i].authorized = JSON.stringify(robot);});
    return players;
  }
  isSpecialCard(card){
    return this.modeConfig.special.cards.indexOf(card[1]) !== -1;
  }
  colorForSpecialCard(card){
    const { colors } = this.modeConfig.regular;
    return colors[Math.floor(Math.random()*colors.length)]+card[1];
  }
}
